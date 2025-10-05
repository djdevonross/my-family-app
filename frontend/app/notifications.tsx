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
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { pt } from 'date-fns/locale';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  is_admin: boolean;
}

interface Notification {
  id: string;
  recipient_id: string;
  sender_id?: string;
  sender_name?: string;
  type: string;
  title: string;
  message: string;
  icon: string;
  module_icon: string;
  is_read: boolean;
  created_at: string;
  read_at?: string;
  data?: any;
}

interface NotificationType {
  key: string;
  label: string;
  icon: string;
}

export default function NotificationsScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<Notification[]>([]);
  const [notificationTypes, setNotificationTypes] = useState<NotificationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadUser();
    loadNotificationTypes();
    loadNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      loadNotifications();
      loadUnreadCount();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    filterNotifications();
  }, [notifications, activeFilter]);

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

  const loadNotificationTypes = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notifications/types`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const typesData = await response.json();
        setNotificationTypes(typesData.types);
      }
    } catch (error) {
      console.error('Error loading notification types:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const notificationsData = await response.json();
        setNotifications(notificationsData);
        
        // Count unread notifications
        const unreadCount = notificationsData.filter((n: Notification) => !n.is_read).length;
        setUnreadCount(unreadCount);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notifications/count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const countData = await response.json();
        setUnreadCount(countData.unread_count);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const filterNotifications = () => {
    let filtered = notifications;
    
    if (activeFilter === 'unread') {
      filtered = notifications.filter(n => !n.is_read);
    } else if (activeFilter === 'read') {
      filtered = notifications.filter(n => n.is_read);
    } else if (activeFilter !== 'all') {
      filtered = notifications.filter(n => n.type === activeFilter);
    }
    
    setFilteredNotifications(filtered);
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        loadNotifications();
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await loadNotifications();
        // Force immediate UI update
        setTimeout(() => {
          filterNotifications();
        }, 100);
        Alert.alert('Sucesso', 'Todas as notificações foram marcadas como lidas');
      }
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Erro', 'Erro ao marcar notificações como lidas');
    }
  };

  const clearReadNotifications = async () => {
    Alert.alert(
      'Limpar Notificações',
      'Eliminar todas as notificações já lidas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              if (!token) return;

              const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/notifications/clear-read`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                await loadNotifications();
                // Force immediate UI update by resetting filtered notifications
                setFilteredNotifications([]);
                setTimeout(() => {
                  filterNotifications();
                }, 100);
                Alert.alert('Sucesso', 'Notificações lidas eliminadas');
              }
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Erro', 'Erro ao eliminar notificações');
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const formatNotificationDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      
      if (isToday(date)) {
        return `Hoje às ${format(date, 'HH:mm')}`;
      } else if (isYesterday(date)) {
        return `Ontem às ${format(date, 'HH:mm')}`;
      } else {
        return format(date, "dd/MM 'às' HH:mm", { locale: pt });
      }
    } catch {
      return 'Data inválida';
    }
  };

  const getTypeLabel = (type: string) => {
    const typeObj = notificationTypes.find(t => t.key === type);
    return typeObj ? typeObj.label : type;
  };

  const getTypeIcon = (type: string) => {
    const typeObj = notificationTypes.find(t => t.key === type);
    return typeObj ? typeObj.icon : '🔔';
  };

  const renderNotificationCard = (notification: Notification) => {
    return (
      <TouchableOpacity
        key={notification.id}
        style={[
          styles.notificationCard,
          !notification.is_read && styles.unreadNotificationCard
        ]}
        onPress={() => {
          if (!notification.is_read) {
            markAsRead(notification.id);
          }
        }}
      >
        <View style={styles.notificationHeader}>
          <View style={styles.notificationIcons}>
            <Text style={styles.moduleIcon}>{notification.module_icon}</Text>
            {!notification.is_read && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.notificationDate}>
            {formatNotificationDate(notification.created_at)}
          </Text>
        </View>
        
        <View style={styles.notificationContent}>
          <Text style={[
            styles.notificationTitle,
            !notification.is_read && styles.unreadNotificationTitle
          ]}>
            {notification.title}
          </Text>
          
          <Text style={styles.notificationMessage}>
            {notification.message}
          </Text>
          
          {notification.sender_name && (
            <Text style={styles.notificationSender}>
              De: {notification.sender_name}
            </Text>
          )}
        </View>
        
        <View style={styles.notificationFooter}>
          <View style={styles.notificationTypeContainer}>
            <Text style={styles.notificationTypeIcon}>
              {getTypeIcon(notification.type)}
            </Text>
            <Text style={styles.notificationTypeText}>
              {getTypeLabel(notification.type)}
            </Text>
          </View>
          
          {notification.is_read && (
            <Text style={styles.readIndicator}>✓ Lida</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>A carregar notificações...</Text>
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
        <Text style={styles.headerTitle}>🔔 Notificações da Família</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.headerActionButton}>
              <Text style={styles.headerActionText}>Marcar Todas</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{notifications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, styles.unreadStatNumber]}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Não lidas</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{notifications.length - unreadCount}</Text>
          <Text style={styles.statLabel}>Lidas</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'all' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('all')}
          >
            <Text style={[styles.filterText, activeFilter === 'all' && styles.filterTextActive]}>
              📱 Todas
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.filterButton, activeFilter === 'unread' && styles.filterButtonActive]}
            onPress={() => setActiveFilter('unread')}
          >
            <Text style={[styles.filterText, activeFilter === 'unread' && styles.filterTextActive]}>
              🔴 Não Lidas
            </Text>
          </TouchableOpacity>
          
          {notificationTypes.map((type) => (
            <TouchableOpacity
              key={type.key}
              style={[styles.filterButton, activeFilter === type.key && styles.filterButtonActive]}
              onPress={() => setActiveFilter(type.key)}
            >
              <Text style={[styles.filterText, activeFilter === type.key && styles.filterTextActive]}>
                {type.icon} {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Actions Bar */}
      <View style={styles.actionsBar}>
        <Text style={styles.actionsTitle}>
          {activeFilter === 'all' ? 'Todas as notificações' : 
           activeFilter === 'unread' ? 'Não lidas' :
           activeFilter === 'read' ? 'Lidas' :
           `Filtro: ${getTypeLabel(activeFilter)}`}
        </Text>
        
        {notifications.filter(n => n.is_read).length > 0 && (
          <TouchableOpacity onPress={clearReadNotifications} style={styles.clearButton}>
            <Text style={styles.clearButtonText}>Limpar Lidas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      <ScrollView 
        style={styles.notificationsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyTitle}>
              {activeFilter === 'unread' && unreadCount === 0 
                ? 'Parabéns! Não há notificações por ler' 
                : notifications.length === 0 
                ? 'Ainda não há notificações'
                : 'Nenhuma notificação encontrada'
              }
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeFilter === 'unread' && unreadCount === 0
                ? 'Estás em dia com todas as atividades familiares! 🎉'
                : 'As notificações de atividades familiares aparecerão aqui'
              }
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsContainer}>
            {filteredNotifications.map(renderNotificationCard)}
          </View>
        )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerActionButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  headerActionText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E6ED',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  unreadStatNumber: {
    color: '#E74C3C',
  },
  statLabel: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  filtersContainer: {
    backgroundColor: 'white',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E6ED',
  },
  filtersScroll: {
    paddingHorizontal: 16,
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
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E6ED',
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  clearButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  notificationsList: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    lineHeight: 22,
  },
  notificationsContainer: {
    padding: 16,
  },
  notificationCard: {
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
  unreadNotificationCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
    backgroundColor: '#FEF9F9',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  notificationIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  moduleIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E74C3C',
  },
  notificationDate: {
    fontSize: 12,
    color: '#95A5A6',
  },
  notificationContent: {
    marginBottom: 12,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 6,
  },
  unreadNotificationTitle: {
    fontWeight: 'bold',
    color: '#E74C3C',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#34495E',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationSender: {
    fontSize: 12,
    color: '#7F8C8D',
    fontStyle: 'italic',
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTypeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  notificationTypeText: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  readIndicator: {
    fontSize: 12,
    color: '#27AE60',
    fontWeight: '600',
  },
});