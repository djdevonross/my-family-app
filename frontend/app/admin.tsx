import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
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

export default function AdminScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalNotes: 0,
    totalMessages: 0,
  });

  useEffect(() => {
    loadUser();
    loadUsers();
    loadStats();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const userObj = JSON.parse(userData);
        setUser(userObj);
        
        // Check if user is admin
        if (!userObj.is_admin) {
          Alert.alert(
            'Acesso Negado',
            'Apenas administradores podem aceder a esta secção.',
            [
              {
                text: 'OK',
                onPress: () => router.back(),
              },
            ]
          );
        }
      } else {
        router.replace('/');
      }
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const usersData = await response.json();
        setUsers(usersData);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      // Load events
      const eventsResponse = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/events`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Load notes
      const notesResponse = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      // Load messages
      const messagesResponse = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/chat/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const [eventsData, notesData, messagesData] = await Promise.all([
        eventsResponse.ok ? eventsResponse.json() : [],
        notesResponse.ok ? notesResponse.json() : [],
        messagesResponse.ok ? messagesResponse.json() : [],
      ]);

      setStats({
        totalEvents: eventsData.length || 0,
        totalNotes: notesData.length || 0,
        totalMessages: messagesData.length || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const sendNotificationToAll = () => {
    Alert.alert(
      'Notificação para Todos',
      'Esta funcionalidade será implementada em breve com notificações push.',
      [{ text: 'OK' }]
    );
  };

  const exportFamilyData = () => {
    Alert.alert(
      'Exportar Dados',
      'Esta funcionalidade permite exportar todos os dados familiares (eventos, notas, mensagens) para backup.',
      [{ text: 'OK' }]
    );
  };

  const resetAllData = () => {
    Alert.alert(
      'Reiniciar Dados',
      'ATENÇÃO: Esta ação eliminará TODOS os dados da família (eventos, notas, mensagens). Esta ação não pode ser desfeita!',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'ELIMINAR TUDO',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Confirmação Final',
              'Tem ABSOLUTA CERTEZA? Todos os dados serão perdidos permanentemente.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'SIM, ELIMINAR TUDO',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert('Aviso', 'Funcionalidade será implementada numa versão futura.');
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>A carregar painel...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user?.is_admin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDeniedContainer}>
          <Text style={styles.accessDeniedText}>⚠️ Acesso Negado</Text>
          <Text style={styles.accessDeniedSubtext}>
            Apenas administradores podem aceder a esta secção
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButtonHeader}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>⚙️ Administração</Text>
        <View style={styles.adminBadge}>
          <Text style={styles.adminBadgeText}>Admin</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Welcome */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Bem-vindo, {user.name}!</Text>
          <Text style={styles.welcomeSubtitle}>
            Painel de administração da aplicação My Family
          </Text>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>📊 Estatísticas da Família</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{users.length}</Text>
              <Text style={styles.statLabel}>Membros</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalEvents}</Text>
              <Text style={styles.statLabel}>Eventos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalNotes}</Text>
              <Text style={styles.statLabel}>Notas</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalMessages}</Text>
              <Text style={styles.statLabel}>Mensagens</Text>
            </View>
          </View>
        </View>

        {/* Family Members */}
        <View style={styles.membersContainer}>
          <Text style={styles.sectionTitle}>👥 Membros da Família</Text>
          {users.map((member) => (
            <View key={member.id} style={styles.memberCard}>
              <Text style={styles.memberAvatar}>{member.avatar}</Text>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{member.name}</Text>
                <Text style={styles.memberUsername}>@{member.username}</Text>
              </View>
              {member.is_admin && (
                <View style={styles.adminLabel}>
                  <Text style={styles.adminLabelText}>Admin</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Admin Actions */}
        <View style={styles.actionsContainer}>
          <Text style={styles.sectionTitle}>🔧 Ações de Administração</Text>
          
          <TouchableOpacity style={styles.actionButton} onPress={sendNotificationToAll}>
            <Text style={styles.actionIcon}>📢</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Enviar Notificação Geral</Text>
              <Text style={styles.actionSubtitle}>
                Enviar uma notificação push para todos os membros
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={exportFamilyData}>
            <Text style={styles.actionIcon}>📥</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Exportar Dados Familiares</Text>
              <Text style={styles.actionSubtitle}>
                Fazer backup de todos os dados da família
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionButton} onPress={() => loadStats()}>
            <Text style={styles.actionIcon}>🔄</Text>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Atualizar Estatísticas</Text>
              <Text style={styles.actionSubtitle}>
                Recarregar todas as estatísticas da aplicação
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.dangerButton]} 
            onPress={resetAllData}
          >
            <Text style={styles.actionIcon}>⚠️</Text>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, styles.dangerText]}>
                Reiniciar Todos os Dados
              </Text>
              <Text style={[styles.actionSubtitle, styles.dangerText]}>
                CUIDADO: Elimina permanentemente todos os dados
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.sectionTitle}>ℹ️ Informações da Aplicação</Text>
          <View style={styles.infoCard}>
            <Text style={styles.infoItem}>📱 My Family v1.0</Text>
            <Text style={styles.infoItem}>🏠 Organização Familiar</Text>
            <Text style={styles.infoItem}>🇵🇹 Feito em Portugal</Text>
            <Text style={styles.infoItem}>💚 Com amor pela família</Text>
          </View>
        </View>
      </ScrollView>
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
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  accessDeniedText: {
    fontSize: 24,
    color: '#E74C3C',
    marginBottom: 16,
    textAlign: 'center',
  },
  accessDeniedSubtext: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 32,
  },
  backButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: 'white',
    fontWeight: '600',
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
  backButtonHeader: {
    fontSize: 16,
    color: '#FF6B35',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  adminBadge: {
    backgroundColor: '#9B59B6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  welcomeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 16,
  },
  statsContainer: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '22%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
    textAlign: 'center',
  },
  membersContainer: {
    marginBottom: 24,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  memberAvatar: {
    fontSize: 32,
    marginRight: 16,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  memberUsername: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  adminLabel: {
    backgroundColor: '#9B59B6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminLabelText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  actionsContainer: {
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerButton: {
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  dangerText: {
    color: '#E74C3C',
  },
  infoContainer: {
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  infoItem: {
    fontSize: 16,
    color: '#34495E',
    marginBottom: 8,
    textAlign: 'center',
  },
});