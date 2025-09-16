import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
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

interface ChatMessage {
  id: string;
  message: string;
  created_by: string;
  created_by_name: string;
  created_by_avatar: string;
  created_at: string;
}

export default function ChatScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadUser();
    loadMessages();
    
    // Poll for new messages every 3 seconds (simple polling instead of WebSocket for now)
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
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

  const loadMessages = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/chat/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const messagesData = await response.json();
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token || !user) return;

      // For now, we'll create the message directly via API
      // TODO: Replace with Socket.IO implementation
      const messageData = {
        message: newMessage.trim(),
      };

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/chat/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messageData),
      });

      if (response.ok) {
        setNewMessage('');
        loadMessages(); // Reload messages
      } else {
        Alert.alert('Erro', 'Erro ao enviar mensagem');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Erro', 'Erro de conexão');
    } finally {
      setSending(false);
    }
  };

  const formatMessageTime = (dateString: string) => {
    const messageDate = parseISO(dateString);
    const now = new Date();
    const isToday = messageDate.toDateString() === now.toDateString();
    
    if (isToday) {
      return format(messageDate, 'HH:mm', { locale: pt });
    } else {
      return format(messageDate, "dd/MM 'às' HH:mm", { locale: pt });
    }
  };

  const isMyMessage = (message: ChatMessage) => {
    return message.created_by === user?.id;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>A carregar mensagens...</Text>
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
        <Text style={styles.headerTitle}>💬 Chat Familiar</Text>
        <View style={styles.onlineStatus}>
          <View style={styles.onlineDot} />
          <Text style={styles.onlineText}>Online</Text>
        </View>
      </View>

      {/* Messages */}
      <ScrollView 
        style={styles.messagesContainer} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 ? (
          <View style={styles.noMessagesContainer}>
            <Text style={styles.noMessagesText}>
              Ainda não há mensagens no chat familiar
            </Text>
            <Text style={styles.noMessagesSubtext}>
              Seja o primeiro a enviar uma mensagem! 💬
            </Text>
          </View>
        ) : (
          messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageWrapper,
                isMyMessage(message) ? styles.myMessageWrapper : styles.otherMessageWrapper,
              ]}
            >
              {!isMyMessage(message) && (
                <View style={styles.messageInfo}>
                  <Text style={styles.messageAvatar}>{message.created_by_avatar}</Text>
                  <Text style={styles.messageName}>{message.created_by_name}</Text>
                </View>
              )}
              
              <View
                style={[
                  styles.messageBubble,
                  isMyMessage(message) ? styles.myMessageBubble : styles.otherMessageBubble,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    isMyMessage(message) ? styles.myMessageText : styles.otherMessageText,
                  ]}
                >
                  {message.message}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    isMyMessage(message) ? styles.myMessageTime : styles.otherMessageTime,
                  ]}
                >
                  {formatMessageTime(message.created_at)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Message Input */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.messageInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Escreva uma mensagem..."
            placeholderTextColor="#999"
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={sendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.sendButtonText}>➤</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F2F5',
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
  onlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2ECC71',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 12,
    color: '#2ECC71',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  noMessagesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  noMessagesText: {
    fontSize: 18,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 8,
  },
  noMessagesSubtext: {
    fontSize: 14,
    color: '#95A5A6',
    textAlign: 'center',
  },
  messageWrapper: {
    marginBottom: 16,
  },
  myMessageWrapper: {
    alignItems: 'flex-end',
  },
  otherMessageWrapper: {
    alignItems: 'flex-start',
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginLeft: 8,
  },
  messageAvatar: {
    fontSize: 16,
    marginRight: 6,
  },
  messageName: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  myMessageBubble: {
    backgroundColor: '#FF6B35',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: 'white',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 4,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#2C3E50',
  },
  messageTime: {
    fontSize: 11,
    alignSelf: 'flex-end',
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  otherMessageTime: {
    color: '#95A5A6',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E0E6ED',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E0E6ED',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
    backgroundColor: '#F8F9FA',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#BDC3C7',
  },
  sendButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});