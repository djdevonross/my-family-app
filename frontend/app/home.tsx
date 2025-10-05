import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  is_admin: boolean;
}

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUser();
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
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Terminar Sessão',
      'Tem a certeza que deseja terminar a sessão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Terminar',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('auth_token');
            await AsyncStorage.removeItem('user_data');
            router.replace('/');
          },
        },
      ]
    );
  };

  const navigateToSection = (section: string) => {
    router.push(`/${section}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>A carregar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            <Text style={styles.avatar}>{user?.avatar}</Text>
            <View>
              <Text style={styles.welcomeBack}>Olá,</Text>
              <Text style={styles.userName}>{user?.name}!</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>

        {/* Welcome Message */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>
            👋 Bem-vindo à tua vida familiar organizada!
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Organize eventos, partilhe momentos e mantenha a família unida.
          </Text>
        </View>

        {/* Main Features Grid */}
        <View style={styles.featuresGrid}>
          <TouchableOpacity
            style={[styles.featureCard, styles.calendarCard]}
            onPress={() => navigateToSection('calendar')}
          >
            <Text style={styles.featureIcon}>📅</Text>
            <Text style={styles.featureTitle}>Calendário</Text>
            <Text style={styles.featureSubtitle}>
              Gerir eventos familiares
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.featureCard, styles.chatCard]}
            onPress={() => navigateToSection('chat')}
          >
            <Text style={styles.featureIcon}>💬</Text>
            <Text style={styles.featureTitle}>Chat Familiar</Text>
            <Text style={styles.featureSubtitle}>
              Conversar em família
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.featureCard, styles.notesCard]}
            onPress={() => navigateToSection('notes')}
          >
            <Text style={styles.featureIcon}>📝</Text>
            <Text style={styles.featureTitle}>Notas</Text>
            <Text style={styles.featureSubtitle}>
              Partilhar notas e fotos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.featureCard, styles.tasksCard]}
            onPress={() => navigateToSection('tasks')}
          >
            <Text style={styles.featureIcon}>✅</Text>
            <Text style={styles.featureTitle}>Tarefas</Text>
            <Text style={styles.featureSubtitle}>
              Organizar responsabilidades
            </Text>
          </TouchableOpacity>
        </View>

        {/* Second Row */}
        <View style={styles.featuresGrid}>
          <TouchableOpacity
            style={[styles.featureCard, styles.contactsCard]}
            onPress={() => navigateToSection('contacts')}
          >
            <Text style={styles.featureIcon}>📞</Text>
            <Text style={styles.featureTitle}>Contactos</Text>
            <Text style={styles.featureSubtitle}>
              Números importantes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.featureCard, styles.adminCard]}
            onPress={() => navigateToSection('admin')}
          >
            <Text style={styles.featureIcon}>⚙️</Text>
            <Text style={styles.featureTitle}>Administração</Text>
            <Text style={styles.featureSubtitle}>
              Gerir a aplicação
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsTitle}>Estado da Família</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>5</Text>
              <Text style={styles.statLabel}>Membros</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>-</Text>
              <Text style={styles.statLabel}>Eventos</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>-</Text>
              <Text style={styles.statLabel}>Notas</Text>
            </View>
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
    paddingBottom: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    fontSize: 40,
    marginRight: 12,
  },
  welcomeBack: {
    fontSize: 16,
    color: '#7F8C8D',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  logoutButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: 'white',
    fontWeight: '600',
  },
  welcomeCard: {
    backgroundColor: 'white',
    margin: 24,
    marginTop: 8,
    padding: 24,
    borderRadius: 16,
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
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 24,
    paddingTop: 8,
    gap: 16,
  },
  featureCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  calendarCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#3498DB',
  },
  chatCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2ECC71',
  },
  notesCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  tasksCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#27AE60',
  },
  adminSection: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  fullWidthCard: {
    minWidth: '100%',
  },
  adminCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#9B59B6',
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
    textAlign: 'center',
  },
  featureSubtitle: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 16,
  },
  statsContainer: {
    margin: 24,
    marginTop: 8,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
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
  },
});