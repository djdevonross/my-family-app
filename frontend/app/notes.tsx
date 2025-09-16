import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { format, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  is_admin: boolean;
}

interface Note {
  id: string;
  title: string;
  content: string;
  images: string[];
  created_by: string;
  created_by_name: string;
  created_at: string;
}

export default function NotesScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    images: [] as string[],
  });
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  useEffect(() => {
    loadUser();
    loadNotes();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        setUser(JSON.parse(userData));
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadNotes = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const notesData = await response.json();
        setNotes(notesData);
      }
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const createNote = async () => {
    if (!newNote.title.trim() && !newNote.content.trim()) {
      Alert.alert('Erro', 'Por favor, insira um título ou conteúdo para a nota');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const noteData = {
        ...newNote,
        images: selectedImages,
        title: newNote.title.trim() || 'Nota sem título',
      };

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(noteData),
      });

      if (response.ok) {
        setShowNoteModal(false);
        setNewNote({ title: '', content: '', images: [] });
        setSelectedImages([]);
        loadNotes();
        Alert.alert('Sucesso', 'Nota criada com sucesso!');
      } else {
        Alert.alert('Erro', 'Erro ao criar nota');
      }
    } catch (error) {
      console.error('Error creating note:', error);
      Alert.alert('Erro', 'Erro de conexão');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setSelectedImages([...selectedImages, base64Image]);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erro', 'Erro ao selecionar imagem');
    }
  };

  const removeImage = (index: number) => {
    setSelectedImages(selectedImages.filter((_, i) => i !== index));
  };

  const formatDate = (dateString: string) => {
    return format(parseISO(dateString), "dd 'de' MMMM 'às' HH:mm", { locale: pt });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>A carregar notas...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📝 Notas Familiares</Text>
        <TouchableOpacity onPress={() => setShowNoteModal(true)}>
          <Text style={styles.addButton}>+ Nota</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {notes.length === 0 ? (
          <View style={styles.noNotesContainer}>
            <Text style={styles.noNotesText}>Ainda não há notas partilhadas</Text>
            <TouchableOpacity
              style={styles.createNoteButton}
              onPress={() => setShowNoteModal(true)}
            >
              <Text style={styles.createNoteText}>Criar Primeira Nota</Text>
            </TouchableOpacity>
          </View>
        ) : (
          notes.map((note) => (
            <View key={note.id} style={styles.noteCard}>
              <View style={styles.noteHeader}>
                <Text style={styles.noteTitle}>{note.title}</Text>
                <Text style={styles.noteAuthor}>{note.created_by_name}</Text>
              </View>

              {note.content ? (
                <Text style={styles.noteContent}>{note.content}</Text>
              ) : null}

              {note.images && note.images.length > 0 && (
                <View style={styles.imagesContainer}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {note.images.map((image, index) => (
                      <Image
                        key={index}
                        source={{ uri: image }}
                        style={styles.noteImage}
                        resizeMode="cover"
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              <Text style={styles.noteDate}>
                {formatDate(note.created_at)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* New Note Modal */}
      <Modal
        visible={showNoteModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => {
                setShowNoteModal(false);
                setNewNote({ title: '', content: '', images: [] });
                setSelectedImages([]);
              }}>
                <Text style={styles.modalCancelButton}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Nova Nota</Text>
              <TouchableOpacity onPress={createNote}>
                <Text style={styles.modalSaveButton}>Guardar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Título</Text>
                <TextInput
                  style={styles.input}
                  value={newNote.title}
                  onChangeText={(text) => setNewNote({ ...newNote, title: text })}
                  placeholder="Título da nota (opcional)"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Conteúdo</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={newNote.content}
                  onChangeText={(text) => setNewNote({ ...newNote, content: text })}
                  placeholder="Escreva a sua nota aqui..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={6}
                />
              </View>

              <View style={styles.inputContainer}>
                <View style={styles.imagesHeader}>
                  <Text style={styles.inputLabel}>
                    Imagens ({selectedImages.length})
                  </Text>
                  <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                    <Text style={styles.addImageText}>+ Adicionar Foto</Text>
                  </TouchableOpacity>
                </View>

                {selectedImages.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectedImagesContainer}>
                    {selectedImages.map((image, index) => (
                      <View key={index} style={styles.selectedImageWrapper}>
                        <Image
                          source={{ uri: image }}
                          style={styles.selectedImage}
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                        >
                          <Text style={styles.removeImageText}>×</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>

              <View style={styles.noteInfoContainer}>
                <Text style={styles.noteInfo}>
                  💡 As suas notas e imagens serão partilhadas com toda a família
                </Text>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E6ED',
  },
  backButton: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  addButton: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  noNotesContainer: {
    backgroundColor: 'white',
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 40,
  },
  noNotesText: {
    fontSize: 18,
    color: '#7F8C8D',
    marginBottom: 24,
    textAlign: 'center',
  },
  createNoteButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createNoteText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  noteCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
    marginRight: 12,
  },
  noteAuthor: {
    fontSize: 12,
    color: '#7F8C8D',
    backgroundColor: '#F0F8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  noteContent: {
    fontSize: 16,
    color: '#34495E',
    lineHeight: 24,
    marginBottom: 16,
  },
  imagesContainer: {
    marginBottom: 12,
  },
  noteImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
  },
  noteDate: {
    fontSize: 12,
    color: '#95A5A6',
    textAlign: 'right',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  modalContent: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E6ED',
  },
  modalCancelButton: {
    fontSize: 16,
    color: '#E74C3C',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  modalSaveButton: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  modalForm: {
    flex: 1,
    padding: 16,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#34495E',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E6ED',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  textArea: {
    height: 120,
    textAlignVertical: 'top',
  },
  imagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addImageButton: {
    backgroundColor: '#3498DB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addImageText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  selectedImagesContainer: {
    flexDirection: 'row',
  },
  selectedImageWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  noteInfoContainer: {
    backgroundColor: '#E8F5E8',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2ECC71',
  },
  noteInfo: {
    fontSize: 14,
    color: '#27AE60',
    textAlign: 'center',
  },
});