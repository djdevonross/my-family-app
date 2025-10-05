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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { format, parseISO, addDays, isBefore, isAfter } from 'date-fns';
import { pt } from 'date-fns/locale';

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface User {
  id: string;
  username: string;
  name: string;
  avatar: string;
  is_admin: boolean;
}

interface Task {
  id: string;
  title: string;
  description: string;
  responsible_id: string;
  responsible_name: string;
  responsible_avatar: string;
  due_date?: string;
  status: 'por_fazer' | 'em_progresso' | 'concluida';
  created_by: string;
  created_by_name: string;
  created_at: string;
  completed_at?: string;
}

const STATUS_COLORS = {
  por_fazer: '#3498DB',
  em_progresso: '#F39C12',
  concluida: '#2ECC71',
};

const STATUS_LABELS = {
  por_fazer: 'Por Fazer',
  em_progresso: 'Em Progresso',
  concluida: 'Concluída',
};

const STATUS_ICONS = {
  por_fazer: '⏳',
  em_progresso: '🔄',
  concluida: '✅',
};

export default function TasksScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterUser, setFilterUser] = useState<string>('all');
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    responsible_id: '',
    due_date: '',
    status: 'por_fazer' as const,
  });
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    in_progress: 0,
    pending: 0,
    all_completed: false,
  });

  useEffect(() => {
    loadUser();
    loadUsers();
    loadTasks();
    loadStats();
  }, []);

  useEffect(() => {
    filterTasks();
  }, [tasks, filterStatus, filterUser, searchTerm]);

  const loadUser = async () => {
    try {
      const userData = await AsyncStorage.getItem('user_data');
      if (userData) {
        const userObj = JSON.parse(userData);
        setUser(userObj);
        setNewTask(prev => ({ ...prev, responsible_id: userObj.id }));
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
    }
  };

  const loadTasks = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const tasksData = await response.json();
        setTasks(tasksData);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/tasks/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const filterTasks = () => {
    let filtered = tasks;

    // Filter by status
    if (filterStatus !== 'all') {
      filtered = filtered.filter(task => task.status === filterStatus);
    }

    // Filter by user
    if (filterUser !== 'all') {
      filtered = filtered.filter(task => task.responsible_id === filterUser);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredTasks(filtered);
  };

  const createTask = async () => {
    if (!newTask.title.trim()) {
      Alert.alert('Erro', 'Por favor, insira um título para a tarefa');
      return;
    }

    if (!newTask.responsible_id) {
      Alert.alert('Erro', 'Por favor, selecione um responsável');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const taskData = {
        ...newTask,
        due_date: newTask.due_date ? new Date(newTask.due_date).toISOString() : null,
      };

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/tasks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(taskData),
      });

      if (response.ok) {
        setShowTaskModal(false);
        resetTaskForm();
        loadTasks();
        loadStats();
        Alert.alert('Sucesso', 'Tarefa criada com sucesso!');
      } else {
        Alert.alert('Erro', 'Erro ao criar tarefa');
      }
    } catch (error) {
      console.error('Error creating task:', error);
      Alert.alert('Erro', 'Erro de conexão');
    }
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        loadTasks();
        loadStats();
      } else {
        Alert.alert('Erro', 'Erro ao atualizar tarefa');
      }
    } catch (error) {
      console.error('Error updating task:', error);
      Alert.alert('Erro', 'Erro de conexão');
    }
  };

  const deleteTask = async (taskId: string) => {
    Alert.alert(
      'Eliminar Tarefa',
      'Tem a certeza que deseja eliminar esta tarefa?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('auth_token');
              if (!token) return;

              const response = await fetch(`${EXPO_PUBLIC_BACKEND_URL}/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (response.ok) {
                loadTasks();
                loadStats();
                Alert.alert('Sucesso', 'Tarefa eliminada');
              }
            } catch (error) {
              console.error('Error deleting task:', error);
            }
          },
        },
      ]
    );
  };

  const resetTaskForm = () => {
    setNewTask({
      title: '',
      description: '',
      responsible_id: user?.id || '',
      due_date: '',
      status: 'por_fazer',
    });
    setEditingTask(null);
  };

  const openTaskModal = (task?: Task) => {
    if (task) {
      setEditingTask(task);
      setNewTask({
        title: task.title,
        description: task.description,
        responsible_id: task.responsible_id,
        due_date: task.due_date ? format(parseISO(task.due_date), 'yyyy-MM-dd') : '',
        status: task.status,
      });
    } else {
      resetTaskForm();
    }
    setShowTaskModal(true);
  };

  const getTaskPriority = (task: Task) => {
    if (!task.due_date) return 'normal';
    
    const dueDate = parseISO(task.due_date);
    const today = new Date();
    const tomorrow = addDays(today, 1);
    
    if (isBefore(dueDate, today)) return 'overdue';
    if (isBefore(dueDate, tomorrow)) return 'urgent';
    return 'normal';
  };

  const formatDueDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), "dd 'de' MMM", { locale: pt });
    } catch {
      return '';
    }
  };

  const renderTaskCard = (task: Task) => {
    const priority = getTaskPriority(task);
    const isOverdue = priority === 'overdue' && task.status !== 'concluida';
    
    return (
      <View key={task.id} style={[
        styles.taskCard,
        { borderLeftColor: STATUS_COLORS[task.status] },
        isOverdue && styles.overdueTask
      ]}>
        <View style={styles.taskHeader}>
          <View style={styles.taskInfo}>
            <Text style={styles.taskTitle}>{task.title}</Text>
            <Text style={styles.taskResponsible}>
              {task.responsible_avatar} {task.responsible_name}
            </Text>
          </View>
          <View style={styles.taskActions}>
            <TouchableOpacity
              style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[task.status] }]}
              onPress={() => {
                const statusOrder = ['por_fazer', 'em_progresso', 'concluida'];
                const currentIndex = statusOrder.indexOf(task.status);
                const nextIndex = (currentIndex + 1) % statusOrder.length;
                const nextStatus = statusOrder[nextIndex] as Task['status'];
                updateTask(task.id, { status: nextStatus });
              }}
            >
              <Text style={styles.statusText}>
                {STATUS_ICONS[task.status]} {STATUS_LABELS[task.status]}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => openTaskModal(task)}>
              <Text style={styles.editButton}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteTask(task.id)}>
              <Text style={styles.deleteButtonTask}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {task.description && (
          <Text style={styles.taskDescription}>{task.description}</Text>
        )}
        
        <View style={styles.taskFooter}>
          {task.due_date && (
            <Text style={[
              styles.taskDueDate,
              isOverdue && styles.overdueDueDate
            ]}>
              📅 {formatDueDate(task.due_date)}
              {isOverdue && ' (Em atraso)'}
            </Text>
          )}
          <Text style={styles.taskCreator}>Criado por {task.created_by_name}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>A carregar tarefas...</Text>
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
        <Text style={styles.headerTitle}>✅ Tarefas Familiares</Text>
        <TouchableOpacity onPress={() => openTaskModal()}>
          <Text style={styles.addButton}>+ Tarefa</Text>
        </TouchableOpacity>
      </View>

      {/* Stats and Celebration */}
      {stats.all_completed && stats.total > 0 && (
        <View style={styles.celebrationCard}>
          <Text style={styles.celebrationText}>
            🎉 Tudo em dia! A família está de parabéns 🎉
          </Text>
          <Text style={styles.celebrationSubtext}>
            Todas as {stats.total} tarefas foram concluídas!
          </Text>
        </View>
      )}

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Por Fazer</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.in_progress}</Text>
          <Text style={styles.statLabel}>Em Progresso</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Concluídas</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Filters and Search */}
      <View style={styles.filtersContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholder="Pesquisar tarefas..."
          placeholderTextColor="#999"
        />
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          <TouchableOpacity
            style={[styles.filterButton, filterStatus === 'all' && styles.filterButtonActive]}
            onPress={() => setFilterStatus('all')}
          >
            <Text style={[styles.filterText, filterStatus === 'all' && styles.filterTextActive]}>
              Todas
            </Text>
          </TouchableOpacity>
          
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <TouchableOpacity
              key={status}
              style={[styles.filterButton, filterStatus === status && styles.filterButtonActive]}
              onPress={() => setFilterStatus(status)}
            >
              <Text style={[styles.filterText, filterStatus === status && styles.filterTextActive]}>
                {STATUS_ICONS[status as keyof typeof STATUS_ICONS]} {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tasks List */}
      <ScrollView style={styles.tasksContainer}>
        {filteredTasks.length === 0 ? (
          <View style={styles.noTasksContainer}>
            <Text style={styles.noTasksText}>
              {tasks.length === 0 
                ? 'Ainda não há tarefas criadas' 
                : 'Nenhuma tarefa encontrada com os filtros aplicados'
              }
            </Text>
            <TouchableOpacity
              style={styles.createTaskButton}
              onPress={() => openTaskModal()}
            >
              <Text style={styles.createTaskText}>
                {tasks.length === 0 ? 'Criar Primeira Tarefa' : 'Criar Nova Tarefa'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.tasksList}>
            {filteredTasks.map(renderTaskCard)}
          </View>
        )}
      </ScrollView>

      {/* Task Modal */}
      <Modal
        visible={showTaskModal}
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
                setShowTaskModal(false);
                resetTaskForm();
              }}>
                <Text style={styles.modalCancelButton}>Cancelar</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingTask ? 'Editar Tarefa' : 'Nova Tarefa'}
              </Text>
              <TouchableOpacity onPress={createTask}>
                <Text style={styles.modalSaveButton}>Guardar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Título *</Text>
                <TextInput
                  style={styles.input}
                  value={newTask.title}
                  onChangeText={(text) => setNewTask({ ...newTask, title: text })}
                  placeholder="Título da tarefa"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Descrição</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={newTask.description}
                  onChangeText={(text) => setNewTask({ ...newTask, description: text })}
                  placeholder="Descrição opcional"
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Responsável *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {users.map((user) => (
                    <TouchableOpacity
                      key={user.id}
                      style={[
                        styles.userOption,
                        newTask.responsible_id === user.id && styles.userOptionSelected
                      ]}
                      onPress={() => setNewTask({ ...newTask, responsible_id: user.id })}
                    >
                      <Text style={styles.userAvatar}>{user.avatar}</Text>
                      <Text style={[
                        styles.userName,
                        newTask.responsible_id === user.id && styles.userNameSelected
                      ]}>
                        {user.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Data Limite</Text>
                <TextInput
                  style={styles.input}
                  value={newTask.due_date}
                  onChangeText={(text) => setNewTask({ ...newTask, due_date: text })}
                  placeholder="YYYY-MM-DD (opcional)"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Estado</Text>
                <View style={styles.statusOptions}>
                  {Object.entries(STATUS_LABELS).map(([status, label]) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.statusOption,
                        newTask.status === status && styles.statusOptionSelected,
                        { borderColor: STATUS_COLORS[status as keyof typeof STATUS_COLORS] }
                      ]}
                      onPress={() => setNewTask({ ...newTask, status: status as Task['status'] })}
                    >
                      <Text style={[
                        styles.statusOptionText,
                        newTask.status === status && styles.statusOptionTextSelected
                      ]}>
                        {STATUS_ICONS[status as keyof typeof STATUS_ICONS]} {label}
                      </Text>
                    </TouchableOpacity>
                  ))}
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
  celebrationCard: {
    backgroundColor: '#E8F5E8',
    margin: 16,
    padding: 20,
    borderRadius: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#2ECC71',
    alignItems: 'center',
  },
  celebrationText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#27AE60',
    textAlign: 'center',
    marginBottom: 8,
  },
  celebrationSubtext: {
    fontSize: 14,
    color: '#27AE60',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  statLabel: {
    fontSize: 10,
    color: '#7F8C8D',
    marginTop: 4,
    textAlign: 'center',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: 'white',
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
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E6ED',
  },
  filterButtonActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  filterText: {
    fontSize: 14,
    color: '#7F8C8D',
    fontWeight: '600',
  },
  filterTextActive: {
    color: 'white',
  },
  tasksContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  noTasksContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noTasksText: {
    fontSize: 18,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 24,
  },
  createTaskButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createTaskText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  tasksList: {
    paddingBottom: 20,
  },
  taskCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  overdueTask: {
    borderColor: '#E74C3C',
    backgroundColor: '#FDEDEC',
  },
  taskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  taskInfo: {
    flex: 1,
    marginRight: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 4,
  },
  taskResponsible: {
    fontSize: 14,
    color: '#7F8C8D',
  },
  taskActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  editButton: {
    fontSize: 16,
    padding: 4,
  },
  deleteButtonTask: {
    fontSize: 16,
    padding: 4,
  },
  taskDescription: {
    fontSize: 14,
    color: '#34495E',
    lineHeight: 20,
    marginBottom: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskDueDate: {
    fontSize: 12,
    color: '#34495E',
    fontWeight: '600',
  },
  overdueDueDate: {
    color: '#E74C3C',
    fontWeight: 'bold',
  },
  taskCreator: {
    fontSize: 11,
    color: '#95A5A6',
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
  userOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E0E6ED',
  },
  userOptionSelected: {
    borderColor: '#FF6B35',
    backgroundColor: '#FFF3E0',
  },
  userAvatar: {
    fontSize: 24,
    marginBottom: 4,
  },
  userName: {
    fontSize: 12,
    color: '#7F8C8D',
    textAlign: 'center',
  },
  userNameSelected: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  statusOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  statusOption: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statusOptionSelected: {
    backgroundColor: '#FFF3E0',
  },
  statusOptionText: {
    fontSize: 12,
    color: '#7F8C8D',
    fontWeight: '600',
    textAlign: 'center',
  },
  statusOptionTextSelected: {
    color: '#FF6B35',
  },
});