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
  Vibration,
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

interface SOSAlert {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string;
  date_time: string;
  confirmed: boolean;
  status: 'active' | 'resolved' | 'cancelled';
  contacts_notified: ContactNotification[];
  message: string;
  location?: {
    lat: number;
    lng: number;
    accuracy: number;
  };
  cancelled_at?: string;
}

interface ContactNotification {
  name: string;
  phone_number: string;
  relation: string;
  notification_sent: boolean;
  method: string;
  timestamp: string;
}

interface Contact {
  id: string;
  name: string;
  relation: string;
  phone_number: string;
  is_sos_priority: boolean;
}

export default function SOSScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sosContacts, setSosContacts] = useState<Contact[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<SOSAlert[]>([]);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const [activeAlert, setActiveAlert] = useState<SOSAlert | null>(null);
  const [showCancelButton, setShowCancelButton] = useState(false);

  useEffect(() => {
    loadUser();
    loadSOSContacts();
    loadRecentAlerts();
    
    // Poll for active alerts every 10 seconds
    const interval = setInterval(() => {
      loadRecentAlerts();
    }, 10000);
    
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

  const loadSOSContacts = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/contacts/sos`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const contactsData = await response.json();
        setSosContacts(contactsData);
      }
    } catch (error) {
      console.error('Error loading SOS contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentAlerts = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/sos/alerts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const alertsData = await response.json();
        setRecentAlerts(alertsData);
        
        // Check for active alert from current user
        const userActiveAlert = alertsData.find(
          (alert: SOSAlert) => alert.user_id === user?.id && alert.status === 'active'
        );
        setActiveAlert(userActiveAlert || null);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const showSOSConfirmation = () => {
    setShowConfirmation(true);
  };

  const sendSOSAlert = async () => {
    if (sosContacts.length === 0) {
      Alert.alert(
        'Sem Contactos SOS',
        'Não há contactos de emergência configurados. Configure contactos prioritários no módulo "Contactos Principais" primeiro.',
        [
          { text: 'OK' },
          {
            text: 'Ir para Contactos',
            onPress: () => router.push('/contacts')
          }
        ]
      );
      return;
    }

    setSendingAlert(true);
    setShowConfirmation(false);

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      // Get location (optional - in real app would use expo-location)
      const alertData = {
        message: "Emergência acionada via aplicação My Family",
        device_id: "mobile_app"
      };

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/sos/alert`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });

      if (response.ok) {
        const alertResponse = await response.json();
        
        // Show success feedback
        setAlertSent(true);
        setActiveAlert(alertResponse);
        
        // Vibrate and provide feedback
        Vibration.vibrate([200, 100, 200]);
        
        // Show cancel button for 10 seconds
        setShowCancelButton(true);
        setTimeout(() => {
          setShowCancelButton(false);
        }, 10000);
        
        // Reload data
        loadRecentAlerts();
        
        Alert.alert(
          '🚨 Alerta Enviado!',
          `Alerta de emergência enviado para ${sosContacts.length} contacto(s). A família foi notificada no chat.`,
          [{ text: 'OK' }]
        );
      } else {
        const errorData = await response.json();
        Alert.alert('Erro', errorData.detail || 'Erro ao enviar alerta SOS');
      }
    } catch (error) {
      console.error('Error sending SOS alert:', error);
      Alert.alert('Erro', 'Erro de conexão ao enviar alerta');
    } finally {
      setSendingAlert(false);
      setTimeout(() => setAlertSent(false), 3000);
    }
  };

  const cancelSOSAlert = async () => {
    if (!activeAlert) return;

    Alert.alert(
      'Cancelar Alerta SOS',
      'Tem a certeza que deseja cancelar o alerta de emergência? Isto notificará todos os contactos.',
      [
        { text: 'Não', style: 'cancel' },
        {
          text: 'Sim, Cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              if (!token) return;

              const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/sos/alert/${activeAlert.id}/cancel`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                setActiveAlert(null);
                setShowCancelButton(false);
                loadRecentAlerts();
                Alert.alert('Sucesso', 'Alerta SOS cancelado. A família foi notificada.');
              }
            } catch (error) {
              console.error('Error cancelling SOS alert:', error);
            }
          },
        },
      ]
    );
  };

  const resolveSOSAlert = async (alertId: string) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/sos/alert/${alertId}/resolve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        loadRecentAlerts();
        Alert.alert('Sucesso', 'Alerta SOS marcado como resolvido.');
      }
    } catch (error) {
      console.error('Error resolving SOS alert:', error);
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: pt });
    } catch {
      return 'Data inválida';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#E74C3C';
      case 'resolved': return '#27AE60';
      case 'cancelled': return '#95A5A6';
      default: return '#34495E';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'resolved': return 'Resolvido';
      case 'cancelled': return 'Cancelado';
      default: return 'Desconhecido';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#E74C3C" />
          <Text style={styles.loadingText}>A carregar sistema SOS...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Confirmation Screen
  if (showConfirmation) {
    return (
      <SafeAreaView style={styles.confirmationContainer}>
        <View style={styles.confirmationContent}>
          <Text style={styles.confirmationTitle}>
            🚨 Confirmar Emergência
          </Text>
          <Text style={styles.confirmationMessage}>
            Confirma que queres enviar um alerta de emergência?
          </Text>
          <Text style={styles.confirmationDetails}>
            Será enviado para {sosContacts.length} contacto(s) de emergência e toda a família será notificada.
          </Text>

          <TouchableOpacity 
            style={styles.confirmSOSButton}
            onPress={sendSOSAlert}
            disabled={sendingAlert}
          >
            {sendingAlert ? (
              <ActivityIndicator color="white" size="large" />
            ) : (
              <Text style={styles.confirmSOSButtonText}>🚨 SOS</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.cancelConfirmButton}
            onPress={() => setShowConfirmation(false)}
          >
            <Text style={styles.cancelConfirmText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Success feedback screen
  if (alertSent) {
    return (
      <SafeAreaView style={styles.successContainer}>
        <View style={styles.successContent}>
          <Text style={styles.successTitle}>✅ Alerta Enviado!</Text>
          <Text style={styles.successMessage}>
            Emergência comunicada com sucesso. A ajuda está a caminho.
          </Text>
          {showCancelButton && (
            <TouchableOpacity 
              style={styles.cancelAlertButton}
              onPress={cancelSOSAlert}
            >
              <Text style={styles.cancelAlertText}>Cancelar Alerta</Text>
            </TouchableOpacity>
          )}
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
        <Text style={styles.headerTitle}>🚨 Sistema SOS</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Active Alert Warning */}
        {activeAlert && (
          <View style={styles.activeAlertCard}>
            <Text style={styles.activeAlertTitle}>⚠️ Alerta Ativo</Text>
            <Text style={styles.activeAlertMessage}>
              Tens um alerta SOS ativo desde {formatDateTime(activeAlert.date_time)}
            </Text>
            <View style={styles.activeAlertActions}>
              <TouchableOpacity
                style={styles.cancelActiveButton}
                onPress={cancelSOSAlert}
              >
                <Text style={styles.cancelActiveText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resolveActiveButton}
                onPress={() => resolveSOSAlert(activeAlert.id)}
              >
                <Text style={styles.resolveActiveText}>Resolver</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Main SOS Button */}
        <View style={styles.sosButtonContainer}>
          <Text style={styles.sosInstructions}>
            Em caso de emergência, pressiona o botão abaixo
          </Text>
          <TouchableOpacity 
            style={[
              styles.sosButton,
              activeAlert && styles.sosButtonDisabled
            ]}
            onPress={showSOSConfirmation}
            disabled={!!activeAlert}
          >
            <Text style={styles.sosButtonText}>🚨 SOS</Text>
            <Text style={styles.sosButtonSubtext}>Emergência Familiar</Text>
          </TouchableOpacity>
          
          {activeAlert && (
            <Text style={styles.disabledMessage}>
              Tens um alerta ativo. Cancela ou resolve o alerta atual primeiro.
            </Text>
          )}
        </View>

        {/* SOS Contacts Info */}
        <View style={styles.contactsInfo}>
          <Text style={styles.sectionTitle}>📞 Contactos de Emergência</Text>
          {sosContacts.length === 0 ? (
            <View style={styles.noContactsCard}>
              <Text style={styles.noContactsText}>
                Nenhum contacto de emergência configurado
              </Text>
              <TouchableOpacity 
                style={styles.configureContactsButton}
                onPress={() => router.push('/contacts')}
              >
                <Text style={styles.configureContactsText}>
                  Configurar Contactos
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.contactsList}>
              {sosContacts.map((contact) => (
                <View key={contact.id} style={styles.contactCard}>
                  <Text style={styles.contactName}>
                    🚨 {contact.name}
                  </Text>
                  <Text style={styles.contactInfo}>
                    {contact.relation} • {contact.phone_number}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Alerts */}
        <View style={styles.recentAlerts}>
          <Text style={styles.sectionTitle}>📋 Histórico Recente</Text>
          {recentAlerts.length === 0 ? (
            <View style={styles.noAlertsCard}>
              <Text style={styles.noAlertsText}>Nenhum alerta registado</Text>
            </View>
          ) : (
            <View style={styles.alertsList}>
              {recentAlerts.slice(0, 5).map((alert) => (
                <View key={alert.id} style={styles.alertCard}>
                  <View style={styles.alertHeader}>
                    <Text style={styles.alertUser}>
                      {alert.user_avatar} {alert.user_name}
                    </Text>
                    <View style={[
                      styles.alertStatus,
                      { backgroundColor: getStatusColor(alert.status) }
                    ]}>
                      <Text style={styles.alertStatusText}>
                        {getStatusText(alert.status)}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.alertDate}>
                    {formatDateTime(alert.date_time)}
                  </Text>
                  
                  <Text style={styles.alertContacts}>
                    {alert.contacts_notified.length} contacto(s) notificado(s)
                  </Text>
                  
                  {alert.status === 'active' && alert.user_id !== user?.id && (
                    <TouchableOpacity
                      style={styles.resolveButton}
                      onPress={() => resolveSOSAlert(alert.id)}
                    >
                      <Text style={styles.resolveButtonText}>
                        Marcar como Resolvido
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          )}
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
  confirmationContainer: {
    flex: 1,
    backgroundColor: '#FDECEC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmationContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  confirmationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 16,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: 18,
    color: '#2C3E50',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationDetails: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 32,
    textAlign: 'center',
  },
  confirmSOSButton: {
    backgroundColor: '#E74C3C',
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  confirmSOSButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  cancelConfirmButton: {
    backgroundColor: '#95A5A6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelConfirmText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
  },
  successTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#27AE60',
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 18,
    color: '#2C3E50',
    marginBottom: 24,
    textAlign: 'center',
  },
  cancelAlertButton: {
    backgroundColor: '#E74C3C',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelAlertText: {
    color: 'white',
    fontSize: 16,
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
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  activeAlertCard: {
    backgroundColor: '#FDECEC',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  activeAlertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 8,
  },
  activeAlertMessage: {
    fontSize: 14,
    color: '#2C3E50',
    marginBottom: 16,
  },
  activeAlertActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelActiveButton: {
    flex: 1,
    backgroundColor: '#E74C3C',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelActiveText: {
    color: 'white',
    fontWeight: '600',
  },
  resolveActiveButton: {
    flex: 1,
    backgroundColor: '#27AE60',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveActiveText: {
    color: 'white',
    fontWeight: '600',
  },
  sosButtonContainer: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sosInstructions: {
    fontSize: 16,
    color: '#2C3E50',
    textAlign: 'center',
    marginBottom: 24,
  },
  sosButton: {
    backgroundColor: '#E74C3C',
    width: 150,
    height: 150,
    borderRadius: 75,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#E74C3C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  sosButtonDisabled: {
    backgroundColor: '#BDC3C7',
    shadowColor: '#BDC3C7',
  },
  sosButtonText: {
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sosButtonSubtext: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledMessage: {
    fontSize: 14,
    color: '#7F8C8D',
    textAlign: 'center',
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 12,
  },
  contactsInfo: {
    margin: 16,
  },
  noContactsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#F39C12',
  },
  noContactsText: {
    fontSize: 16,
    color: '#7F8C8D',
    marginBottom: 16,
    textAlign: 'center',
  },
  configureContactsButton: {
    backgroundColor: '#F39C12',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  configureContactsText: {
    color: 'white',
    fontWeight: '600',
  },
  contactsList: {
    gap: 8,
  },
  contactCard: {
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#E74C3C',
  },
  contactName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  contactInfo: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  recentAlerts: {
    margin: 16,
    marginTop: 0,
  },
  noAlertsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  noAlertsText: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  alertsList: {
    gap: 12,
  },
  alertCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertUser: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  alertStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertStatusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  alertDate: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  alertContacts: {
    fontSize: 14,
    color: '#34495E',
  },
  resolveButton: {
    backgroundColor: '#27AE60',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 8,
  },
  resolveButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});