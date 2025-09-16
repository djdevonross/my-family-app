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
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { format, parseISO, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { pt } from 'date-fns/locale';

// Configure Portuguese locale for calendar
LocaleConfig.locales['pt'] = {
  monthNames: [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ],
  monthNamesShort: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'],
  dayNames: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  dayNamesShort: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  today: 'Hoje'
};
LocaleConfig.defaultLocale = 'pt';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  is_admin: boolean;
}

interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  created_by: string;
  created_by_name: string;
  color: string;
  alert_minutes: number;
  created_at: string;
}

const USER_COLORS = {
  'Pai': '#3498DB',
  'Mãe': '#E91E63',
  'João': '#4CAF50',
  'Maria': '#FF9800',
  'Avó': '#9C27B0',
};

export default function CalendarScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    date: new Date().toISOString(),
    alert_minutes: 30,
  });
  const [selectedEventDate, setSelectedEventDate] = useState('');

  useEffect(() => {
    loadUser();
    loadEvents();
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

  const loadEvents = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/events`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const eventsData = await response.json();
        setEvents(eventsData);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async () => {
    if (!newEvent.title.trim()) {
      Alert.alert('Erro', 'Por favor, insira um título para o evento');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const eventData = {
        ...newEvent,
        color: USER_COLORS[user?.name as keyof typeof USER_COLORS] || '#3498DB',
        date: selectedEventDate + 'T12:00:00',
      };

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      });

      if (response.ok) {
        setShowEventModal(false);
        setNewEvent({
          title: '',
          description: '',
          date: new Date().toISOString(),
          alert_minutes: 30,
        });
        loadEvents();
        Alert.alert('Sucesso', 'Evento criado com sucesso!');
      } else {
        Alert.alert('Erro', 'Erro ao criar evento');
      }
    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Erro', 'Erro de conexão');
    }
  };

  const deleteEvent = async (eventId: string) => {
    Alert.alert(
      'Eliminar Evento',
      'Tem a certeza que deseja eliminar este evento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              if (!token) return;

              const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/events/${eventId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                loadEvents();
                Alert.alert('Sucesso', 'Evento eliminado');
              }
            } catch (error) {
              console.error('Error deleting event:', error);
            }
          },
        },
      ]
    );
  };

  const getMarkedDates = () => {
    const marked: any = {};
    
    events.forEach(event => {
      const date = event.date.split('T')[0];
      marked[date] = {
        marked: true,
        dotColor: event.color,
        customStyles: {
          container: {
            borderColor: event.color,
            borderWidth: 1,
          },
          text: {
            color: '#2C3E50',
            fontWeight: 'bold',
          },
        },
      };
    });

    // Highlight selected date
    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: '#FF6B35',
    };

    return marked;
  };

  const getEventsForDate = (date: string) => {
    return events.filter(event => event.date.split('T')[0] === date);
  };

  const formatEventTime = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'HH:mm', { locale: pt });
    } catch (error) {
      return '12:00';
    }
  };

  const formatDisplayDate = (dateString: string, formatString: string) => {
    try {
      if (!dateString || dateString === '') return 'Data inválida';
      return format(parseISO(dateString + 'T00:00:00'), formatString, { locale: pt });
    } catch (error) {
      return 'Data inválida';
    }
  };

  const openNewEventModal = (date?: string) => {
    setSelectedEventDate(date || selectedDate);
    setShowEventModal(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>A carregar calendário...</Text>
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
        <Text style={styles.headerTitle}>📅 Calendário Familiar</Text>
        <TouchableOpacity onPress={() => openNewEventModal()}>
          <Text style={styles.addButton}>+ Evento</Text>
        </TouchableOpacity>
      </View>

      {/* View Mode Selector */}
      <View style={styles.viewModeContainer}>
        {(['month', 'week', 'day'] as const).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.viewModeButton,
              viewMode === mode && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode(mode)}
          >
            <Text
              style={[
                styles.viewModeText,
                viewMode === mode && styles.viewModeTextActive,
              ]}
            >
              {mode === 'month' ? 'Mês' : mode === 'week' ? 'Semana' : 'Dia'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Calendar */}
        <View style={styles.calendarContainer}>
          <Calendar
            current={selectedDate}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            markedDates={getMarkedDates()}
            monthFormat={'MMMM yyyy'}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#b6c1cd',
              selectedDayBackgroundColor: '#FF6B35',
              selectedDayTextColor: '#ffffff',
              todayTextColor: '#FF6B35',
              dayTextColor: '#2d4150',
              textDisabledColor: '#d9e1e8',
              dotColor: '#00adf5',
              selectedDotColor: '#ffffff',
              arrowColor: '#FF6B35',
              disabledArrowColor: '#d9e1e8',
              monthTextColor: '#2C3E50',
              indicatorColor: '#FF6B35',
            }}
          />
        </View>

        {/* Events for Selected Date */}
        <View style={styles.eventsContainer}>
          <View style={styles.eventsHeader}>
            <Text style={styles.eventsTitle}>
              Eventos para {selectedDate ? 
                formatDisplayDate(selectedDate, 'dd \'de\' MMMM') :
                'hoje'
              }
            </Text>
            <TouchableOpacity
              style={styles.addEventButton}
              onPress={() => openNewEventModal(selectedDate)}
            >
              <Text style={styles.addEventText}>+</Text>
            </TouchableOpacity>
          </View>

          {getEventsForDate(selectedDate).length === 0 ? (
            <View style={styles.noEventsContainer}>
              <Text style={styles.noEventsText}>Nenhum evento para este dia</Text>
              <TouchableOpacity
                style={styles.createEventButton}
                onPress={() => openNewEventModal(selectedDate)}
              >
                <Text style={styles.createEventText}>Criar Evento</Text>
              </TouchableOpacity>
            </View>
          ) : (
            getEventsForDate(selectedDate).map((event) => (
              <View key={event.id} style={[styles.eventCard, { borderLeftColor: event.color }]}>
                <View style={styles.eventHeader}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  <View style={styles.eventActions}>
                    <Text style={styles.eventCreator}>{event.created_by_name}</Text>
                    {event.created_by === user?.id && (
                      <TouchableOpacity onPress={() => deleteEvent(event.id)}>
                        <Text style={styles.deleteButton}>🗑️</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {event.description ? (
                  <Text style={styles.eventDescription}>{event.description}</Text>
                ) : null}
                <View style={styles.eventFooter}>
                  <Text style={styles.eventTime}>
                    ⏰ {formatEventTime(event.date)}
                  </Text>
                  <Text style={styles.eventAlert}>
                    🔔 {event.alert_minutes} min antes
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* New Event Modal */}
      <Modal
        visible={showEventModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowEventModal(false)}>
                <Text style={styles.modalCancelButton}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Novo Evento</Text>
              <TouchableOpacity onPress={createEvent}>
                <Text style={styles.modalSaveButton}>Guardar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Título *</Text>
                <TextInput
                  style={styles.input}
                  value={newEvent.title}
                  onChangeText={(text) => setNewEvent({ ...newEvent, title: text })}
                  placeholder="Título do evento"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Descrição</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={newEvent.description}
                  onChangeText={(text) => setNewEvent({ ...newEvent, description: text })}
                  placeholder="Descrição opcional"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Data Selecionada</Text>
                <View style={styles.dateDisplay}>
                  <Text style={styles.dateText}>
                    {selectedEventDate ? 
                      format(parseISO(selectedEventDate + 'T00:00:00'), 'dd \'de\' MMMM \'de\' yyyy', { locale: pt }) :
                      'Selecione uma data'
                    }
                  </Text>
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Alerta (minutos antes)</Text>
                <View style={styles.alertOptions}>
                  {[15, 30, 60, 120].map((minutes) => (
                    <TouchableOpacity
                      key={minutes}
                      style={[
                        styles.alertOption,
                        newEvent.alert_minutes === minutes && styles.alertOptionActive,
                      ]}
                      onPress={() => setNewEvent({ ...newEvent, alert_minutes: minutes })}
                    >
                      <Text
                        style={[
                          styles.alertOptionText,
                          newEvent.alert_minutes === minutes && styles.alertOptionTextActive,
                        ]}
                      >
                        {minutes} min
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Cor do Evento</Text>
                <View style={styles.colorPreview}>
                  <View
                    style={[
                      styles.colorBox,
                      { backgroundColor: USER_COLORS[user?.name as keyof typeof USER_COLORS] || '#3498DB' },
                    ]}
                  />
                  <Text style={styles.colorText}>
                    Cor de {user?.name}: {USER_COLORS[user?.name as keyof typeof USER_COLORS] || '#3498DB'}
                  </Text>
                </View>
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
  viewModeContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 8,
    padding: 4,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  viewModeButtonActive: {
    backgroundColor: '#FF6B35',
  },
  viewModeText: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  viewModeTextActive: {
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  calendarContainer: {
    backgroundColor: 'white',
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  eventsContainer: {
    margin: 16,
    marginTop: 8,
  },
  eventsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  addEventButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FF6B35',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addEventText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  noEventsContainer: {
    backgroundColor: 'white',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  noEventsText: {
    fontSize: 16,
    color: '#7F8C8D',
    marginBottom: 16,
  },
  createEventButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createEventText: {
    color: 'white',
    fontWeight: '600',
  },
  eventCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    flex: 1,
  },
  eventActions: {
    alignItems: 'flex-end',
  },
  eventCreator: {
    fontSize: 12,
    color: '#7F8C8D',
    marginBottom: 4,
  },
  deleteButton: {
    fontSize: 16,
  },
  eventDescription: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 12,
    lineHeight: 20,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventTime: {
    fontSize: 12,
    color: '#34495E',
    fontWeight: '600',
  },
  eventAlert: {
    fontSize: 12,
    color: '#34495E',
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
    height: 80,
    textAlignVertical: 'top',
  },
  dateDisplay: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E6ED',
    borderRadius: 8,
    padding: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#2C3E50',
  },
  alertOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  alertOption: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E6ED',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  alertOptionActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  alertOptionText: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  alertOptionTextActive: {
    color: 'white',
  },
  colorPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E0E6ED',
    borderRadius: 8,
    padding: 12,
  },
  colorBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
  },
  colorText: {
    fontSize: 14,
    color: '#7F8C8D',
  },
});