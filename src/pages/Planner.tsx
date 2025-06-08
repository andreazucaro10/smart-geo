import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Trash2,
  X
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  TouchSensor,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

// Interfacce TypeScript
interface PlannerCategory {
  id: number;
  slug: string;
  name: string;
  color: string;
  order_position: number;
  active: boolean;
}

interface PlannerTask {
  id: number;
  description: string;
  day: string; // 'monday', 'tuesday', etc.
  category: number; // ID della categoria
  week_start_date: string; // YYYY-MM-DD
  order_position: number;
}

// Giorni della settimana
const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Lunedì', short: 'LUN' },
  { key: 'tuesday', label: 'Martedì', short: 'MAR' },
  { key: 'wednesday', label: 'Mercoledì', short: 'MER' },
  { key: 'thursday', label: 'Giovedì', short: 'GIO' },
  { key: 'friday', label: 'Venerdì', short: 'VEN' },
  { key: 'saturday', label: 'Sabato', short: 'SAB' },
  { key: 'sunday', label: 'Domenica', short: 'DOM' },
];



// Componente per le task trascinabili
interface DraggableTaskProps {
  task: PlannerTask;
  category: PlannerCategory;
  onEdit: (task: PlannerTask) => void;
  onDelete: (taskId: number) => void;
}

const DraggableTask: React.FC<DraggableTaskProps> = ({ task, category, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id.toString() });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };



  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        touchAction: isDragging ? 'none' : 'manipulation'
      }}
      {...attributes}
      {...listeners}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onEdit(task);
      }}

      className={`
        group bg-white dark:bg-gray-800 rounded-lg mb-1 shadow-sm border border-gray-200 dark:border-gray-700
        cursor-grab active:cursor-grabbing hover:shadow-md transition-all duration-200 text-xs
        ${isDragging ? 'opacity-50 rotate-1 scale-105' : ''}
        relative overflow-hidden touch-manipulation select-none
      `}
    >
      {/* Striscetta colorata a sinistra */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: category.color }}
      ></div>
      
      <div className="flex items-start justify-between p-2 pl-3">
        <div className="flex-1 min-w-0 pr-2">
          <p className="font-medium text-gray-900 dark:text-white text-xs leading-relaxed break-words select-none">
            {task.description}
          </p>
        </div>
        <div className="flex gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente per le celle della griglia
interface GridCellProps {
  category: PlannerCategory;
  day: string;
  tasks: PlannerTask[];
  onEdit: (task: PlannerTask) => void;
  onDelete: (taskId: number) => void;
}

const GridCell: React.FC<GridCellProps> = ({ category, day, tasks, onEdit, onDelete }) => {
  const { setNodeRef, isOver, active } = useDroppable({
    id: `${category.id}-${day}`,
  });

  // Controlla se l'elemento che stiamo trascinando può essere droppato qui
  const canDrop = active && active.id !== `${category.id}-${day}`;

  return (
    <div 
      ref={setNodeRef}
      className={`
        group min-h-[120px] p-2 border border-gray-200 dark:border-gray-700 transition-all duration-200
        bg-white dark:bg-gray-800 relative
        ${isOver && canDrop ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600 border-2' : ''}
        ${canDrop && !isOver ? 'border-dashed border-gray-400 dark:border-gray-500' : ''}
        ${tasks.length > 3 ? 'min-h-[180px]' : 'min-h-[120px]'}
      `}
    >
      {/* Bottone + per aggiungere task (solo desktop) */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          // Chiama la funzione per aggiungere task con categoria e giorno preimpostati
          const addTaskEvent = new CustomEvent('addTaskToCell', {
            detail: { categoryId: category.id, day: day }
          });
          window.dispatchEvent(addTaskEvent);
        }}
        className="
          flex md:hidden absolute bottom-2 right-2 w-8 h-8 items-center justify-center
          bg-blue-500 active:bg-blue-600 text-white rounded-full text-base font-bold
          opacity-100 transition-all duration-200 shadow-md active:shadow-lg z-10
          md:w-6 md:h-6 md:text-sm md:opacity-0 md:group-hover:opacity-100 md:hover:bg-blue-600
        "
        title="Aggiungi task"
      >
        +
      </button>

      <SortableContext items={tasks.map(t => t.id.toString())} strategy={verticalListSortingStrategy}>
        <div className="space-y-1">
          {tasks.map((task) => (
            <DraggableTask
              key={task.id}
              task={task}
              category={category}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          
          {/* Zona di drop estesa per celle con molte task */}
          {tasks.length > 3 && canDrop && (
            <div className={`
              h-8 rounded-lg border-2 border-dashed transition-all duration-200
              ${isOver ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-600'}
              flex items-center justify-center
            `}>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {isOver ? 'Rilascia qui' : 'Zona di drop'}
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
};

export const Planner: React.FC = () => {
  const { user } = useAuthStore();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday;
  });

  // Aggiunge CSS per migliorare il touch handling
  React.useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .dnd-touch-fix * {
        touch-action: none !important;
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
      }
      
      /* Previeni selezione testo su mobile per il planner */
      @media (max-width: 768px) {
        .planner-container * {
          -webkit-touch-callout: none !important;
          -webkit-user-select: none !important;
          -khtml-user-select: none !important;
          -moz-user-select: none !important;
          -ms-user-select: none !important;
          user-select: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        
        .planner-container {
          -webkit-overflow-scrolling: touch;
        }
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, []);
  
  const [categories, setCategories] = useState<PlannerCategory[]>([]);
  const [tasks, setTasks] = useState<PlannerTask[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<PlannerTask | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    category: 0,
    day: 'monday',
  });
  const [activeId, setActiveId] = useState<number | null>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 0,
        tolerance: 15,
      },
    })
  );

  // Carica categorie dal database
  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('planner_categories')
        .select('*')
        .eq('user_id', user?.id)
        .eq('active', true)
        .order('order_position', { ascending: true });

      if (error) throw error;
      
      setCategories(data || []);
    } catch (error) {
      console.error('Errore caricamento categorie:', error);
      toast.error('Errore nel caricamento delle categorie');
    }
  };

  // Carica task dal database
  const loadTasks = async () => {
    try {
      const weekStartStr = currentWeekStart.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('planner_tasks')
        .select('*')
        .eq('user_id', user?.id)
        .eq('week_start_date', weekStartStr)
        .order('category', { ascending: true })
        .order('day', { ascending: true })
        .order('order_position', { ascending: true });

      if (error) throw error;
      
      // Verifica e correggi eventuali order_position mancanti o duplicati
      if (data && data.length > 0) {
        await fixOrderPositions(data);
      }
      
      setTasks(data || []);
    } catch (error) {
      console.error('Errore caricamento task:', error);
      toast.error('Errore nel caricamento delle task');
    }
  };

  // Funzione per correggere le posizioni delle task
  const fixOrderPositions = async (tasksData: PlannerTask[]) => {
    const updates = [];
    
    // Raggruppa per categoria e giorno
    const groups = tasksData.reduce((acc, task) => {
      const key = `${task.category}-${task.day}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {} as Record<string, PlannerTask[]>);
    
    // Per ogni gruppo, verifica e correggi le posizioni
    for (const groupTasks of Object.values(groups)) {
      for (let index = 0; index < groupTasks.length; index++) {
        const task = groupTasks[index];
        if (task.order_position !== index) {
          updates.push(
            supabase
              .from('planner_tasks')
              .update({ order_position: index })
              .eq('id', task.id)
          );
          task.order_position = index; // Aggiorna anche l'oggetto locale
        }
      }
    }
    
    if (updates.length > 0) {
      await Promise.all(updates);
    }
  };

  useEffect(() => {
    if (user) {
      loadCategories();
      loadTasks();
    }
  }, [user, currentWeekStart]);

  // Listener per l'evento di aggiunta task da cella specifica
  useEffect(() => {
    const handleAddTaskToCellEvent = (event: CustomEvent) => {
      const { categoryId, day } = event.detail;
      handleAddTaskToCell(categoryId, day);
    };

    window.addEventListener('addTaskToCell', handleAddTaskToCellEvent as EventListener);
    
    return () => {
      window.removeEventListener('addTaskToCell', handleAddTaskToCellEvent as EventListener);
    };
  }, [categories]);

  // Focus sul campo descrizione quando si apre il modal
  useEffect(() => {
    if (showModal && descriptionRef.current) {
      const timer = setTimeout(() => {
        descriptionRef.current?.focus();
      }, 100); // Piccolo delay per assicurarsi che il modal sia completamente renderizzato
      
      return () => clearTimeout(timer);
    }
  }, [showModal]);

  // Gestione shortcut CTRL + INVIO per salvare
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showModal && event.ctrlKey && event.key === 'Enter') {
        event.preventDefault();
        handleSaveTask();
      }
    };

    if (showModal) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showModal, formData]); // Include formData per avere accesso ai dati aggiornati

  // Gestione drag & drop
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(Number(event.active.id));
    
    // Aggiungi classe per bloccare il touch su tutto il documento durante il drag
    document.body.classList.add('dnd-touch-fix');
    
    // Feedback aptico su mobile (vibrazione se supportata)
    if ('vibrate' in navigator && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      navigator.vibrate(50);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) {
      console.log('Drop fallito: nessun target trovato');
      setActiveId(null);
      // Rimuovi classe di blocco touch
      document.body.classList.remove('dnd-touch-fix');
      return;
    }

    const activeId = Number(active.id);
    const overId = over.id as string;

    // Se stiamo trascinando su un'altra task (riordinamento)
    if (!overId.includes('-')) {
      const overTaskId = Number(overId);
      const activeTask = tasks.find(t => t.id === activeId);
      const overTask = tasks.find(t => t.id === overTaskId);
      
      if (activeTask && overTask && activeId !== overTaskId) {
        // Riordinamento all'interno della stessa cella
        if (activeTask.category === overTask.category && activeTask.day === overTask.day) {
          const cellTasks = tasks
            .filter(t => t.category === activeTask.category && t.day === activeTask.day)
            .sort((a, b) => a.order_position - b.order_position);
          
          const activeIndex = cellTasks.findIndex(t => t.id === activeId);
          const overIndex = cellTasks.findIndex(t => t.id === overTaskId);
          
          if (activeIndex !== overIndex) {
            // Riordina le task
            const reorderedTasks = [...cellTasks];
            const [removed] = reorderedTasks.splice(activeIndex, 1);
            reorderedTasks.splice(overIndex, 0, removed);
            
            // Aggiornamento ottimistico: aggiorna subito l'interfaccia
            setTasks(prevTasks => {
              const newTasks = [...prevTasks];
              reorderedTasks.forEach((task, index) => {
                const taskIndex = newTasks.findIndex(t => t.id === task.id);
                if (taskIndex !== -1) {
                  newTasks[taskIndex] = { ...newTasks[taskIndex], order_position: index };
                }
              });
              return newTasks;
            });

            // Sincronizza con il database in background
            const updates = reorderedTasks.map((task, index) => 
              supabase
                .from('planner_tasks')
                .update({ order_position: index })
                .eq('id', task.id)
            );
            
            Promise.all(updates).catch(error => {
              console.error('Errore riordinamento task:', error);
              toast.error('Errore nel riordinamento delle task');
              // In caso di errore, ricarica i dati
              loadTasks();
            });
          }
        }
      }
    } else {
      // Spostamento tra celle diverse
      const [newCategoryStr, newDay] = overId.split('-');
      const newCategoryId = parseInt(newCategoryStr);
      
      if (newCategoryId && newDay) {
        // Calcola la prossima posizione nella cella di destinazione
        const targetCellTasks = tasks.filter(t => 
          t.category === newCategoryId && 
          t.day === newDay
        );
        const nextPosition = targetCellTasks.length > 0 
          ? Math.max(...targetCellTasks.map(t => t.order_position)) + 1 
          : 0;

        // Aggiornamento ottimistico: aggiorna subito l'interfaccia
        setTasks(tasks => 
          tasks.map(task => 
            task.id === activeId 
              ? { ...task, category: newCategoryId, day: newDay, order_position: nextPosition }
              : task
          )
        );

        // Sincronizza con il database in background
        supabase
          .from('planner_tasks')
          .update({ 
            category: newCategoryId, 
            day: newDay,
            order_position: nextPosition
          })
          .eq('id', activeId)
          .then(({ error }) => {
            if (error) {
              console.error('Errore spostamento task:', error);
              toast.error('Errore nello spostamento della task');
              // In caso di errore, ricarica i dati
              loadTasks();
            }
          });
      }
    }

    setActiveId(null);
    
    // Rimuovi classe di blocco touch
    document.body.classList.remove('dnd-touch-fix');
  };

  // Gestione task
  const handleAddTask = () => {
    setEditingTask(null);
    setFormData({
      description: '',
      category: categories[0]?.id || 0,
      day: 'monday',
    });
    setShowModal(true);
  };

  // Gestione task con parametri preimpostati
  const handleAddTaskToCell = (categoryId: number, day: string) => {
    setEditingTask(null);
    setFormData({
      description: '',
      category: categoryId,
      day: day,
    });
    setShowModal(true);
  };

  const handleEditTask = (task: PlannerTask) => {
    setEditingTask(task);
    setFormData({
      description: task.description,
      category: task.category,
      day: task.day,
    });
    setShowModal(true);
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Sei sicuro di voler eliminare questa task?')) return;

    try {
      const { error } = await supabase
        .from('planner_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      setTasks(tasks => tasks.filter(t => t.id !== taskId));
      toast.success('Task eliminata con successo');
    } catch (error) {
      console.error('Errore eliminazione task:', error);
      toast.error('Errore nell\'eliminazione della task');
    }
  };

  const handleSaveTask = async () => {
    if (!formData.description.trim()) {
      toast.error('La descrizione è obbligatoria');
      return;
    }

    try {
      const weekStartStr = currentWeekStart.toISOString().split('T')[0];
      
      if (editingTask) {
        const taskData = {
          description: formData.description.trim(),
          category: formData.category,
          day: formData.day,
          week_start_date: weekStartStr,
          // Mantieni la posizione esistente quando si modifica
        };

        const { error } = await supabase
          .from('planner_tasks')
          .update(taskData)
          .eq('id', editingTask.id);

        if (error) throw error;
        
        setTasks(tasks => 
          tasks.map(task => 
            task.id === editingTask.id
              ? { ...task, ...taskData }
              : task
          )
        );
        toast.success('Task modificata con successo');
      } else {
        // Calcola la prossima posizione per la nuova task
        const existingTasks = tasks.filter(t => 
          t.category === formData.category && 
          t.day === formData.day && 
          t.week_start_date === weekStartStr
        );
        const nextPosition = existingTasks.length > 0 
          ? Math.max(...existingTasks.map(t => t.order_position)) + 1 
          : 0;

        const taskData = {
          description: formData.description.trim(),
          category: formData.category,
          day: formData.day,
          week_start_date: weekStartStr,
          order_position: nextPosition,
        };

        const { data, error } = await supabase
          .from('planner_tasks')
          .insert([{ ...taskData, user_id: user?.id }])
          .select()
          .single();

        if (error) throw error;
        
        setTasks(tasks => [...tasks, data]);
        toast.success('Task aggiunta con successo');
      }

      setShowModal(false);
    } catch (error) {
      console.error('Errore salvataggio task:', error);
      toast.error('Errore nel salvataggio della task');
    }
  };

  // Navigazione settimana
  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekStart(prev => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + (direction === 'next' ? 7 : -7));
      return newDate;
    });
  };

  // Ottieni task per categoria e giorno (ordinate per order_position)
  const getTasksForCategoryAndDay = (categoryId: number, day: string) => {
    return tasks
      .filter(task => task.category === categoryId && task.day === day)
      .sort((a, b) => a.order_position - b.order_position);
  };

  // Formatta data settimana
  const formatWeekRange = () => {
    const endDate = new Date(currentWeekStart);
    endDate.setDate(currentWeekStart.getDate() + 6);
    
    return `${currentWeekStart.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  };

  const activeTask = activeId ? tasks.find(task => task.id === activeId) : null;

  return (
    <div className="space-y-6 planner-container">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planner</h1>
          <p className="text-gray-600 dark:text-gray-300">Gestione settimanale delle attività</p>
        </div>
        <button
          onClick={handleAddTask}
          className="btn btn-primary flex items-center gap-2"
          disabled={categories.length === 0}
        >
          <Plus className="w-4 h-4" />
          Aggiungi task
        </button>
      </div>

      {/* Controlli settimana */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {formatWeekRange()}
          </h2>
          
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              Nessuna categoria trovata. Vai ai Parametri per creare le categorie del planner.
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Griglia planner */}
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header giorni */}
                <div className="grid grid-cols-8 gap-0">
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-medium text-gray-700 dark:text-gray-300">
                    Categoria
                  </div>
                  {DAYS_OF_WEEK.map((day) => (
                    <div key={day.key} className="p-3 text-center bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-medium text-gray-700 dark:text-gray-300">
                      <div className="hidden sm:block">{day.label}</div>
                      <div className="sm:hidden">{day.short}</div>
                    </div>
                  ))}
                </div>

                {/* Righe categorie */}
                {categories.map((category) => (
                  <div key={category.id} className="grid grid-cols-8 gap-0">
                    {/* Nome categoria */}
                    <div className="p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 flex items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: category.color }}
                        ></div>
                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                          {category.name}
                        </span>
                      </div>
                    </div>
                    
                    {/* Celle giorni */}
                    {DAYS_OF_WEEK.map((day) => (
                      <GridCell
                        key={`${category.slug}-${day.key}`}
                        category={category}
                        day={day.key}
                        tasks={getTasksForCategoryAndDay(category.id, day.key)}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <DragOverlay>
              {activeTask ? (
                <div className="transform rotate-3 scale-110 opacity-90 shadow-2xl">
                  <DraggableTask
                    task={activeTask}
                    category={categories.find(c => c.id === activeTask.category) || categories[0]}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {/* Modal per aggiungere/modificare task */}
      {showModal && (
        <div className="modal-overlay">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingTask ? 'Modifica Task' : 'Nuova Task'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Descrizione *
                  </label>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Ctrl + Invio per salvare
                  </span>
                </div>
                <textarea
                  ref={descriptionRef}
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input w-full resize-none"
                  rows={3}
                  placeholder="Descrizione della task"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Categoria
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: parseInt(e.target.value) }))}
                    className="input w-full"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Giorno
                  </label>
                  <select
                    value={formData.day}
                    onChange={(e) => setFormData(prev => ({ ...prev, day: e.target.value }))}
                    className="input w-full"
                  >
                    {DAYS_OF_WEEK.map((day) => (
                      <option key={day.key} value={day.key}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>


            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowModal(false)}
                className="btn btn-outline"
              >
                Annulla
              </button>
              <button
                onClick={handleSaveTask}
                className="btn btn-primary"
                disabled={!formData.description.trim()}
              >
                {editingTask ? 'Modifica' : 'Salva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};