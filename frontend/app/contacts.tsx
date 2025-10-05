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
  Linking,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  is_admin: boolean;
}

interface Contact {
  id: string;
  name: string;
  relation: string;
  phone_number: string;
  contact_type: 'personal' | 'family';
  is_favorite: boolean;
  is_sos_priority: boolean;
  user_id: string;
  created_by_name: string;
  created_at: string;
}

const RELATION_ICONS = {
  'Mãe': '👩',
  'Pai': '👨',
  'Filho': '👦',
  'Filha': '👧',
  'Avó': '👵',
  'Avô': '👴',
  'Médico': '🏥',
  'Escola': '🏫',
  'Emergência': '🚨',
  'Dentista': '🦷',
  'Veterinário': '🐕',
  'Trabalho': '💼',
  'Vizinho': '🏠',
  'Amigo': '🤝',
  'Outro': '📞'
};

const COMMON_RELATIONS = [
  'Mãe', 'Pai', 'Filho', 'Filha', 'Avó', 'Avô', 
  'Médico', 'Escola', 'Emergência', 'Dentista', 
  'Veterinário', 'Trabalho', 'Vizinho', 'Amigo', 'Outro'
];

export default function ContactsScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'personal' | 'family' | 'favorites' | 'sos'>('all');
  const [newContact, setNewContact] = useState({
    name: '',
    relation: 'Outro',
    phone_number: '',
    contact_type: 'personal' as 'personal' | 'family',
    is_favorite: false,
    is_sos_priority: false,
  });

  useEffect(() => {
    loadUser();
    loadContacts();
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

  const loadContacts = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const contactsData = await response.json();
        setContacts(contactsData);
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const createOrUpdateContact = async () => {
    if (!newContact.name.trim()) {
      Alert.alert('Erro', 'Por favor, insira um nome para o contacto');
      return;
    }

    if (!newContact.phone_number.trim()) {
      Alert.alert('Erro', 'Por favor, insira um número de telefone');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const contactData = {
        ...newContact,
        name: newContact.name.trim(),
        phone_number: newContact.phone_number.trim(),
      };

      let response;
      if (editingContact) {
        // Update existing contact
        response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/contacts/${editingContact.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contactData),
        });
      } else {
        // Create new contact
        response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/contacts`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(contactData),
        });
      }

      if (response.ok) {
        setShowContactModal(false);
        resetContactForm();
        loadContacts();
        Alert.alert('Sucesso', editingContact ? 'Contacto atualizado com sucesso!' : 'Contacto criado com sucesso!');
      } else {
        const errorData = await response.json();
        Alert.alert('Erro', errorData.detail || 'Erro ao guardar contacto');
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      Alert.alert('Erro', 'Erro de conexão');
    }
  };

  const deleteContact = async (contactId: string) => {
    Alert.alert(
      'Eliminar Contacto',
      'Tem a certeza que deseja eliminar este contacto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              if (!token) return;

              const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/contacts/${contactId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                loadContacts();
                Alert.alert('Sucesso', 'Contacto eliminado');
              } else {
                const errorData = await response.json();
                Alert.alert('Erro', errorData.detail || 'Erro ao eliminar contacto');
              }
            } catch (error) {
              console.error('Error deleting contact:', error);
            }
          },
        },
      ]
    );
  };

  const makeCall = (phoneNumber: string, contactName: string) => {
    const phoneUrl = `tel:${phoneNumber}`;
    
    Alert.alert(
      'Fazer Ligação',
      `Ligar para ${contactName}?\nNúmero: ${phoneNumber}`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ligar',
          onPress: () => {
            Linking.canOpenURL(phoneUrl).then((supported) => {
              if (supported) {
                Linking.openURL(phoneUrl);
              } else {
                Alert.alert('Erro', 'Não foi possível abrir a aplicação de telefone');
              }
            });
          },
        },
      ]
    );
  };

  const sendSMS = (phoneNumber: string, contactName: string) => {
    const smsUrl = `sms:${phoneNumber}`;
    
    Linking.canOpenURL(smsUrl).then((supported) => {
      if (supported) {
        Linking.openURL(smsUrl);
      } else {
        Alert.alert('Erro', 'Não foi possível abrir a aplicação de mensagens');
      }
    });
  };

  const resetContactForm = () => {
    setNewContact({
      name: '',
      relation: 'Outro',
      phone_number: '',
      contact_type: 'personal',
      is_favorite: false,
      is_sos_priority: false,
    });
    setEditingContact(null);
  };

  const openContactModal = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setNewContact({
        name: contact.name,
        relation: contact.relation,
        phone_number: contact.phone_number,
        contact_type: contact.contact_type,
        is_favorite: contact.is_favorite,
        is_sos_priority: contact.is_sos_priority,
      });
    } else {
      resetContactForm();
    }
    setShowContactModal(true);
  };

  const toggleFavorite = async (contact: Contact) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_favorite: !contact.is_favorite }),
      });

      loadContacts();
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const getFilteredContacts = () => {
    let filtered = contacts;

    // Apply type filter
    if (filterType === 'personal') {
      filtered = filtered.filter(c => c.contact_type === 'personal');
    } else if (filterType === 'family') {
      filtered = filtered.filter(c => c.contact_type === 'family');
    } else if (filterType === 'favorites') {
      filtered = filtered.filter(c => c.is_favorite);
    } else if (filterType === 'sos') {
      filtered = filtered.filter(c => c.is_sos_priority);
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.relation.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone_number.includes(searchTerm)
      );
    }

    return filtered;
  };

  const renderContactCard = (contact: Contact) => {
    const relationIcon = RELATION_ICONS[contact.relation as keyof typeof RELATION_ICONS] || '📞';
    const canEdit = contact.user_id === user?.id || (contact.contact_type === 'family' && user?.is_admin);

    return (
      <View style={[
        styles.contactCard,
        contact.contact_type === 'family' && styles.familyContactCard
      ]}>
        <View style={styles.contactHeader}>
          <View style={styles.contactInfo}>
            <View style={styles.contactTitleRow}>
              <Text style={styles.relationIcon}>{relationIcon}</Text>
              <View style={styles.contactTexts}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactRelation}>{contact.relation}</Text>
              </View>
              <View style={styles.contactBadges}>
                {contact.is_favorite && (
                  <View style={styles.favoriteBadge}>
                    <Text style={styles.badgeText}>💝</Text>
                  </View>
                )}
                {contact.is_sos_priority && (
                  <View style={styles.sosBadge}>
                    <Text style={styles.badgeText}>🚨</Text>
                  </View>
                )}
                {contact.contact_type === 'family' && (
                  <View style={styles.familyBadge}>
                    <Text style={styles.badgeText}>👨‍👩‍👧‍👦</Text>
                  </View>
                )}
              </View>
            </View>
            <Text style={styles.contactPhone}>{contact.phone_number}</Text>
            <Text style={styles.contactCreator}>
              {contact.contact_type === 'family' ? 'Contacto familiar' : `Adicionado por ${contact.created_by_name}`}
            </Text>
          </View>
        </View>

        <View style={styles.contactActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.callButton]}
            onPress={() => makeCall(contact.phone_number, contact.name)}
          >
            <Text style={styles.actionButtonText}>📞 Ligar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.smsButton]}
            onPress={() => sendSMS(contact.phone_number, contact.name)}
          >
            <Text style={styles.actionButtonText}>💬 SMS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.favoriteButton]}
            onPress={() => toggleFavorite(contact)}
          >
            <Text style={styles.actionButtonText}>
              {contact.is_favorite ? '💔' : '❤️'}
            </Text>
          </TouchableOpacity>

          {canEdit && (
            <TouchableOpacity
              style={[styles.actionButton, styles.editButton]}
              onPress={() => openContactModal(contact)}
            >
              <Text style={styles.actionButtonText}>✏️</Text>
            </TouchableOpacity>
          )}

          {canEdit && (
            <TouchableOpacity
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => deleteContact(contact.id)}
            >
              <Text style={styles.actionButtonText}>🗑️</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>A carregar contactos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredContacts = getFilteredContacts();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📞 Contactos Principais</Text>
        <TouchableOpacity onPress={() => openContactModal()}>
          <Text style={styles.addButton}>+ Contacto</Text>
        </TouchableOpacity>
      </View>

      {/* Search and Filters */}
      <View style={styles.filtersContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Pesquisar contactos..."
          placeholderTextColor="#999"
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          {[
            { key: 'all', label: 'Todos', icon: '📱' },
            { key: 'favorites', label: 'Favoritos', icon: '💝' },
            { key: 'sos', label: 'SOS', icon: '🚨' },
            { key: 'family', label: 'Família', icon: '👨‍👩‍👧‍👦' },
            { key: 'personal', label: 'Pessoais', icon: '👤' },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterButton,
                filterType === filter.key && styles.filterButtonActive
              ]}
              onPress={() => setFilterType(filter.key as typeof filterType)}
            >
              <Text style={[
                styles.filterText,
                filterType === filter.key && styles.filterTextActive
              ]}>
                {filter.icon} {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Contacts List */}
      <ScrollView style={styles.contactsContainer}>
        {filteredContacts.length === 0 ? (
          <View style={styles.noContactsContainer}>
            <Text style={styles.noContactsText}>
              {contacts.length === 0 
                ? 'Ainda não há contactos adicionados' 
                : 'Nenhum contacto encontrado com os filtros aplicados'
              }
            </Text>
            <TouchableOpacity
              style={styles.createContactButton}
              onPress={() => openContactModal()}
            >
              <Text style={styles.createContactText}>
                {contacts.length === 0 ? 'Adicionar Primeiro Contacto' : 'Adicionar Novo Contacto'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.contactsList}>
            {filteredContacts.map(renderContactCard)}
          </View>
        )}
      </ScrollView>

      {/* Contact Modal */}
      <Modal
        visible={showContactModal}
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
                setShowContactModal(false);
                resetContactForm();
              }}>
                <Text style={styles.modalCancelButton}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingContact ? 'Editar Contacto' : 'Novo Contacto'}
              </Text>
              <TouchableOpacity onPress={createOrUpdateContact}>
                <Text style={styles.modalSaveButton}>Guardar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Nome *</Text>
                <TextInput
                  style={styles.input}
                  value={newContact.name}
                  onChangeText={(text) => setNewContact({ ...newContact, name: text })}
                  placeholder="Nome do contacto"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Relação</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {COMMON_RELATIONS.map((relation) => (
                    <TouchableOpacity
                      key={relation}
                      style={[
                        styles.relationOption,
                        newContact.relation === relation && styles.relationOptionSelected
                      ]}
                      onPress={() => setNewContact({ ...newContact, relation })}
                    >
                      <Text style={styles.relationIcon}>
                        {RELATION_ICONS[relation as keyof typeof RELATION_ICONS]}
                      </Text>
                      <Text style={[
                        styles.relationText,
                        newContact.relation === relation && styles.relationTextSelected
                      ]}>
                        {relation}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Número de Telefone *</Text>
                <TextInput
                  style={styles.input}
                  value={newContact.phone_number}
                  onChangeText={(text) => setNewContact({ ...newContact, phone_number: text })}
                  placeholder="+351 912 345 678"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Tipo de Contacto</Text>
                <View style={styles.contactTypeContainer}>
                  <TouchableOpacity
                    style={[
                      styles.contactTypeOption,
                      newContact.contact_type === 'personal' && styles.contactTypeSelected
                    ]}
                    onPress={() => setNewContact({ ...newContact, contact_type: 'personal' })}
                  >
                    <Text style={[
                      styles.contactTypeText,
                      newContact.contact_type === 'personal' && styles.contactTypeTextSelected
                    ]}>
                      👤 Pessoal
                    </Text>
                  </TouchableOpacity>
                  
                  {user?.is_admin && (
                    <TouchableOpacity
                      style={[
                        styles.contactTypeOption,
                        newContact.contact_type === 'family' && styles.contactTypeSelected
                      ]}
                      onPress={() => setNewContact({ ...newContact, contact_type: 'family' })}
                    >
                      <Text style={[
                        styles.contactTypeText,
                        newContact.contact_type === 'family' && styles.contactTypeTextSelected
                      ]}>
                        👨‍👩‍👧‍👦 Familiar
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Opções Especiais</Text>
                
                <TouchableOpacity
                  style={[styles.optionRow, newContact.is_favorite && styles.optionRowActive]}
                  onPress={() => setNewContact({ ...newContact, is_favorite: !newContact.is_favorite })}
                >
                  <Text style={styles.optionIcon}>💝</Text>
                  <Text style={styles.optionLabel}>Marcar como favorito</Text>
                  <Text style={styles.optionIndicator}>
                    {newContact.is_favorite ? '✅' : '⭕'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.optionRow, newContact.is_sos_priority && styles.optionRowActive]}
                  onPress={() => setNewContact({ ...newContact, is_sos_priority: !newContact.is_sos_priority })}
                >
                  <Text style={styles.optionIcon}>🚨</Text>
                  <View style={styles.optionLabelContainer}>
                    <Text style={styles.optionLabel}>Contacto de emergência (SOS)</Text>
                    <Text style={styles.optionSubLabel}>
                      Será contactado em situações de emergência
                    </Text>
                  </View>
                  <Text style={styles.optionIndicator}>
                    {newContact.is_sos_priority ? '✅' : '⭕'}
                  </Text>
                </TouchableOpacity>
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
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E6ED',
  },
  searchInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E6ED',
  },
  filtersScroll: {
    flexDirection: 'row',
  },
  filterButton: {
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E6ED',
  },
  filterButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  filterText: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  filterTextActive: {
    color: 'white',
  },
  contactsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  noContactsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noContactsText: {
    fontSize: 18,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
  },
  createContactButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createContactText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  contactsList: {
    paddingBottom: 20,
  },
  contactCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  familyContactCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  contactHeader: {
    marginBottom: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  relationIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  contactTexts: {
    flex: 1,
  },
  contactName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 2,
  },
  contactRelation: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 16,
    color: '#34495E',
    fontWeight: '600',
    marginBottom: 4,
  },
  contactCreator: {
    fontSize: 12,
    color: '#95A5A6',
  },
  contactBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  favoriteBadge: {
    backgroundColor: '#E91E63',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sosBadge: {
    backgroundColor: '#E74C3C',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  familyBadge: {
    backgroundColor: '#3498DB',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButton: {
    backgroundColor: '#2ECC71',
  },
  smsButton: {
    backgroundColor: '#3498DB',
  },
  favoriteButton: {
    backgroundColor: '#E91E63',
  },
  editButton: {
    backgroundColor: '#F39C12',
  },
  deleteButton: {
    backgroundColor: '#E74C3C',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
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
  relationOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E0E6ED',
  },
  relationOptionSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF3E0',
  },
  relationText: {
    fontSize: 10,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 4,
  },
  relationTextSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  contactTypeContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  contactTypeOption: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E0E6ED',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  contactTypeSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF3E0',
  },
  contactTypeText: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  contactTypeTextSelected: {
    color: '#FF6B35',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#E0E6ED',
  },
  optionRowActive: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF3E0',
  },
  optionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  optionLabelContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 14,
    color: '#34495E',
    fontWeight: '600',
  },
  optionSubLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 2,
  },
  optionIndicator: {
    fontSize: 16,
  },
});