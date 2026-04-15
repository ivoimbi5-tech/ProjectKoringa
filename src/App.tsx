/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { auth, db, signIn, logOut } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  Timestamp, 
  deleteDoc, 
  doc,
  serverTimestamp,
  where,
  or,
  increment
} from 'firebase/firestore';
import { Project, ProjectStatus, Comment } from './types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Plus, 
  LogOut, 
  LogIn, 
  ExternalLink, 
  Trash2, 
  Layout, 
  Clock, 
  CheckCircle2, 
  Globe,
  Terminal,
  Edit2,
  Filter,
  Menu,
  BarChart3,
  Search,
  Eye,
  EyeOff,
  Heart,
  MessageSquare,
  TrendingUp,
  User as UserIcon,
  Phone,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { updateDoc } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCommentsDialogOpen, setIsCommentsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ProjectStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<'my-projects' | 'exhibition'>('exhibition');
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [selectedProjectForComments, setSelectedProjectForComments] = useState<Project | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState({
    authorName: '',
    contact: '',
    content: ''
  });
  
  const [likedProjectIds, setLikedProjectIds] = useState<string[]>([]);
  
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    link: '',
    status: 'in-progress' as ProjectStatus,
    isPublic: false
  });

  useEffect(() => {
    const savedLikes = localStorage.getItem('project_likes');
    if (savedLikes) {
      try {
        setLikedProjectIds(JSON.parse(savedLikes));
      } catch (e) {
        console.error("Error parsing likes from localStorage", e);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        setViewMode('my-projects');
      } else {
        setViewMode('exhibition');
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let q;
    if (viewMode === 'exhibition') {
      q = query(
        collection(db, 'projects'), 
        where('isPublic', '==', true),
        orderBy('createdAt', 'desc')
      );
    } else if (user) {
      q = query(
        collection(db, 'projects'), 
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    } else {
      setProjects([]);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projs);
    }, (error) => {
      console.error("Firestore Error:", error);
    });
    return () => unsubscribe();
  }, [user, viewMode]);

  useEffect(() => {
    if (!selectedProjectForComments?.id) {
      setComments([]);
      return;
    }

    // Only fetch comments if the current user is the owner of the project
    if (!user || user.uid !== selectedProjectForComments.userId) {
      setComments([]);
      return;
    }

    const q = query(
      collection(db, 'comments'),
      where('projectId', '==', selectedProjectForComments.id),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const comms = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(comms);
    }, (error) => {
      console.error("Comments Error:", error);
    });

    return () => unsubscribe();
  }, [selectedProjectForComments]);

  const handleAddProject = async () => {
    if (!user || !newProject.name) return;

    try {
      await addDoc(collection(db, 'projects'), {
        ...newProject,
        userId: user.uid,
        createdAt: serverTimestamp(),
        likes: 0,
        accesses: 0,
        xp: 0
      });
      setNewProject({ name: '', description: '', link: '', status: 'in-progress', isPublic: false });
      setIsAddDialogOpen(false);
    } catch (error) {
      console.error("Error adding project:", error);
    }
  };

  const handleUpdateProject = async () => {
    if (!user || !editingProject || !editingProject.id) return;

    try {
      const { id, ...data } = editingProject;
      await updateDoc(doc(db, 'projects', id), data);
      setIsEditDialogOpen(false);
      setEditingProject(null);
    } catch (error) {
      console.error("Error updating project:", error);
    }
  };

  const handleLikeProject = async (project: Project) => {
    if (!project.id || likedProjectIds.includes(project.id)) return;
    
    try {
      const newLikes = (project.likes || 0) + 1;
      const newXP = (newLikes * 10) + ((project.accesses || 0) * 2);
      
      await updateDoc(doc(db, 'projects', project.id), {
        likes: increment(1),
        xp: newXP
      });

      const updatedLikes = [...likedProjectIds, project.id];
      setLikedProjectIds(updatedLikes);
      localStorage.setItem('project_likes', JSON.stringify(updatedLikes));
    } catch (error) {
      console.error("Error liking project:", error);
    }
  };

  const handleAccessProject = async (project: Project) => {
    if (!project.id) return;
    try {
      const newAccesses = (project.accesses || 0) + 1;
      const newXP = ((project.likes || 0) * 10) + (newAccesses * 2);
      await updateDoc(doc(db, 'projects', project.id), {
        accesses: increment(1),
        xp: newXP
      });
    } catch (error) {
      console.error("Error tracking access:", error);
    }
  };

  const handleAddComment = async () => {
    if (!selectedProjectForComments?.id || !newComment.authorName || !newComment.content) return;

    try {
      await addDoc(collection(db, 'comments'), {
        projectId: selectedProjectForComments.id,
        ...newComment,
        createdAt: serverTimestamp()
      });
      setNewComment({ authorName: '', contact: '', content: '' });
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este projeto?")) return;
    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (error) {
      console.error("Error deleting project:", error);
    }
  };

  const getStatusBadge = (status: ProjectStatus) => {
    switch (status) {
      case 'ready':
        return <div className="status-tag status-ready">Pronto</div>;
      case 'in-progress':
        return <div className="status-tag status-pending">Em Desenvolvimento</div>;
      case 'site':
        return <div className="status-tag status-ready">Site</div>;
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || p.status === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    total: projects.length,
    ready: projects.filter(p => p.status === 'ready').length,
    inProgress: projects.filter(p => p.status === 'in-progress').length,
    site: projects.filter(p => p.status === 'site').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-white/10 border-t-[#00f2ff] rounded-full"
        />
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="text-2xl font-extrabold tracking-tighter mb-[60px] flex items-center gap-2.5">
        Project<span className="text-[#00f2ff]">Koringa</span>
      </div>
      
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 mb-2">Navegação</div>
          {user && (
            <div 
              onClick={() => setViewMode('my-projects')}
              className={cn(
                "px-4 py-3 rounded-xl text-sm cursor-pointer flex items-center gap-3 transition-all",
                viewMode === 'my-projects' ? "bg-white/8 border border-white/15 text-white" : "text-white/60 hover:text-white"
              )}
            >
              <Layout size={18} /> Meus Projetos
            </div>
          )}
          <div 
            onClick={() => setViewMode('exhibition')}
            className={cn(
              "px-4 py-3 rounded-xl text-sm cursor-pointer flex items-center gap-3 transition-all",
              viewMode === 'exhibition' ? "bg-white/8 border border-white/15 text-white" : "text-white/60 hover:text-white"
            )}
          >
            <BarChart3 size={18} /> Exposição
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 mb-2">Filtros</div>
          <div 
            onClick={() => setActiveFilter('all')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs cursor-pointer flex items-center gap-3 transition-all",
              activeFilter === 'all' ? "text-[#00f2ff] bg-[#00f2ff]/5" : "text-white/40 hover:text-white/60"
            )}
          >
            Todos
          </div>
          <div 
            onClick={() => setActiveFilter('in-progress')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs cursor-pointer flex items-center gap-3 transition-all",
              activeFilter === 'in-progress' ? "text-[#00f2ff] bg-[#00f2ff]/5" : "text-white/40 hover:text-white/60"
            )}
          >
            <Clock size={14} /> Em Desenvolvimento
          </div>
          <div 
            onClick={() => setActiveFilter('ready')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs cursor-pointer flex items-center gap-3 transition-all",
              activeFilter === 'ready' ? "text-[#00f2ff] bg-[#00f2ff]/5" : "text-white/40 hover:text-white/60"
            )}
          >
            <CheckCircle2 size={14} /> Prontos
          </div>
          <div 
            onClick={() => setActiveFilter('site')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs cursor-pointer flex items-center gap-3 transition-all",
              activeFilter === 'site' ? "text-[#00f2ff] bg-[#00f2ff]/5" : "text-white/40 hover:text-white/60"
            )}
          >
            <Globe size={14} /> Sites Online
          </div>
        </div>
      </div>

      <div className="mt-10 pt-10 border-t border-white/15 space-y-6">
        <div className="text-[10px] font-bold uppercase tracking-widest text-white/40 px-4 mb-2">Estatísticas</div>
        <div className="grid grid-cols-2 gap-4 px-4">
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-white/40 mb-1">Total</div>
            <div className="text-xl font-bold text-[#00f2ff]">{stats.total}</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-white/40 mb-1">Online</div>
            <div className="text-xl font-bold text-emerald-400">{stats.site}</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-white/40 mb-1">Likes</div>
            <div className="text-xl font-bold text-rose-400">{projects.reduce((acc, p) => acc + (p.likes || 0), 0)}</div>
          </div>
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="text-[10px] text-white/40 mb-1">XP Total</div>
            <div className="text-xl font-bold text-amber-400">{projects.reduce((acc, p) => acc + (p.xp || 0), 0)}</div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-10 border-t border-white/15">
        {user ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold ring-1 ring-white/20">
                {user.displayName?.charAt(0)}
              </div>
              <div className="text-xs font-medium truncate text-white/80">{user.displayName}</div>
            </div>
            <Button variant="ghost" size="sm" onClick={logOut} className="w-full justify-start text-white/60 hover:text-red-400 hover:bg-red-400/10">
              <LogOut size={16} className="mr-2" /> Sair
            </Button>
          </div>
        ) : (
          <Button onClick={signIn} className="w-full bg-[#00f2ff] text-black hover:bg-[#00f2ff]/80 font-bold rounded-full">
            <LogIn size={16} className="mr-2" /> Entrar
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="w-[280px] h-screen sticky top-0 bg-black/20 backdrop-blur-[10px] border-r border-white/15 p-10 flex flex-col hidden lg:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Nav */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-black/20 backdrop-blur-md border-b border-white/15 sticky top-0 z-50">
        <div className="text-xl font-extrabold tracking-tighter flex items-center gap-2">
          Project<span className="text-[#00f2ff]">Koringa</span>
        </div>
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="text-white" />}>
            <Menu size={24} />
          </SheetTrigger>
          <SheetContent side="left" className="bg-[#0f172a] border-r border-white/15 text-white p-6 w-[300px]">
            <SidebarContent />
          </SheetContent>
        </Sheet>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-10 flex flex-col">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-10">
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <Input 
              placeholder="Pesquisar projetos..." 
              className="bg-white/8 border-white/15 rounded-full pl-11 pr-5 py-2.5 w-full sm:w-[350px] text-sm text-white/60 placeholder:text-white/40 focus:border-[#00f2ff] transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            {user && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger className="flex-1 sm:flex-none bg-[#00f2ff] text-black border-none px-6 py-2.5 rounded-full font-bold text-sm cursor-pointer hover:scale-105 transition-transform flex items-center justify-center gap-2">
                  <Plus size={18} /> Novo Projeto
                </DialogTrigger>
                <DialogContent className="bg-[#1e293b] border-white/15 text-white backdrop-blur-xl max-w-[95vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Adicionar Projeto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/60">Nome do Projeto</label>
                      <Input 
                        placeholder="Ex: Dashboard E-commerce" 
                        className="bg-white/5 border-white/15 focus:border-[#00f2ff]"
                        value={newProject.name}
                        onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/60">Descrição</label>
                      <Input 
                        placeholder="O que este projeto faz?" 
                        className="bg-white/5 border-white/15 focus:border-[#00f2ff]"
                        value={newProject.description}
                        onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/60">Link (Opcional)</label>
                      <Input 
                        placeholder="https://..." 
                        className="bg-white/5 border-white/15 focus:border-[#00f2ff]"
                        value={newProject.link}
                        onChange={(e) => setNewProject({...newProject, link: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/60">Status</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['in-progress', 'ready', 'site'] as ProjectStatus[]).map((s) => (
                          <Button
                            key={s}
                            variant={newProject.status === s ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setNewProject({...newProject, status: s})}
                            className={cn(
                              "capitalize text-[10px] sm:text-xs px-1",
                              newProject.status === s ? "bg-[#00f2ff] text-black" : "border-white/15 text-white/60"
                            )}
                          >
                            {s.replace('-', ' ')}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-white/60">Exposição Pública</label>
                      <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                          newProject.isPublic ? "bg-[#00f2ff]/20 text-[#00f2ff]" : "bg-white/10 text-white/40"
                        )}>
                          {newProject.isPublic ? <Eye size={20} /> : <EyeOff size={20} />}
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold">{newProject.isPublic ? "Público" : "Privado"}</div>
                          <div className="text-[10px] text-white/40">
                            {newProject.isPublic ? "Todos podem ver este projeto na Exposição" : "Apenas você pode ver este projeto"}
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setNewProject({...newProject, isPublic: !newProject.isPublic})}
                          className="border-white/15 text-xs"
                        >
                          Alterar
                        </Button>
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)} className="text-white/60">Cancelar</Button>
                    <Button onClick={handleAddProject} className="bg-[#00f2ff] text-black hover:bg-[#00f2ff]/80">Salvar Projeto</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </header>

        {/* Stats Summary - Mobile Only */}
        <div className="grid grid-cols-2 gap-4 mb-8 lg:hidden">
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#00f2ff]/10 flex items-center justify-center text-[#00f2ff]">
              <Layout size={20} />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Total</div>
              <div className="text-xl font-bold">{stats.total}</div>
            </div>
          </div>
          <div className="bg-white/5 p-4 rounded-2xl border border-white/10 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Globe size={20} />
            </div>
            <div>
              <div className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Online</div>
              <div className="text-xl font-bold">{stats.site}</div>
            </div>
          </div>
        </div>

        {/* Project Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredProjects.map((project, index) => (
              <motion.div
                key={project.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
                className="bg-white/8 backdrop-blur-[12px] border border-white/15 rounded-[20px] p-6 h-[240px] flex flex-col justify-between group hover:border-[#00f2ff]/40 transition-all relative"
              >
                <div>
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        {getStatusBadge(project.status)}
                        {user && user.uid === project.userId && (
                          <div className={cn(
                            "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md flex items-center gap-1",
                            project.isPublic ? "bg-[#00f2ff]/10 text-[#00f2ff]" : "bg-white/10 text-white/40"
                          )}>
                            {project.isPublic ? <Eye size={10} /> : <EyeOff size={10} />}
                            {project.isPublic ? "Público" : "Privado"}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] font-bold text-white/40">
                        <span className="flex items-center gap-1"><Heart size={10} className="text-rose-500" /> {project.likes || 0}</span>
                        <span className="flex items-center gap-1"><ExternalLink size={10} className="text-[#00f2ff]" /> {project.accesses || 0}</span>
                        <span className="flex items-center gap-1 text-amber-400"><TrendingUp size={10} /> {project.xp || 0} XP</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setSelectedProjectForComments(project);
                          setIsCommentsDialogOpen(true);
                        }}
                        className="text-white/20 hover:text-[#00f2ff] transition-colors"
                        title={user?.uid === project.userId ? "Comentários e Ideias" : "Deixar Sugestão"}
                      >
                        <MessageSquare size={16} />
                      </button>
                      {user && user.uid === project.userId && (
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => {
                              setEditingProject(project);
                              setIsEditDialogOpen(true);
                            }}
                            className="text-white/20 hover:text-[#00f2ff] transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProject(project.id!)}
                            className="text-white/20 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-2 group-hover:text-[#00f2ff] transition-colors line-clamp-1">{project.name}</h3>
                  <p className="text-sm text-white/60 line-clamp-2 leading-relaxed">
                    {project.description || "Sem descrição disponível."}
                  </p>
                </div>

                <div className="flex justify-between items-center mt-4 pt-4 border-t border-white/15">
                  <div className="flex items-center gap-2">
                    {project.link ? (
                      <a 
                        href={project.link.startsWith('http') ? project.link : `https://${project.link}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={() => handleAccessProject(project)}
                        className="text-[#00f2ff] no-underline text-[10px] font-bold flex items-center gap-1.5 hover:text-[#00f2ff]/80 transition-colors bg-[#00f2ff]/10 px-2.5 py-1.5 rounded-lg border border-[#00f2ff]/20"
                      >
                        Acessar Site <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Offline</span>
                    )}
                    <button 
                      onClick={() => handleLikeProject(project)}
                      disabled={project.id ? likedProjectIds.includes(project.id) : false}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-colors",
                        project.id && likedProjectIds.includes(project.id)
                          ? "text-rose-400 bg-rose-400/20 border-rose-400/40 cursor-default"
                          : "text-rose-400 bg-rose-400/10 border-rose-400/20 hover:bg-rose-400/20"
                      )}
                    >
                      <Heart size={10} fill={project.id && likedProjectIds.includes(project.id) ? "currentColor" : "none"} /> 
                      {project.id && likedProjectIds.includes(project.id) ? 'Curtiu' : 'Like'}
                    </button>
                  </div>
                  <span className="text-[10px] text-white/40 font-medium">
                    {project.createdAt?.toDate().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {filteredProjects.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-white/20 py-20">
            <Layout size={64} className="mb-4 opacity-10" />
            <p className="text-lg font-medium">Nenhum projeto encontrado</p>
            <Button 
              variant="link" 
              onClick={() => {setActiveFilter('all'); setSearchQuery('');}}
              className="text-[#00f2ff] mt-2"
            >
              Limpar filtros
            </Button>
          </div>
        )}

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="bg-[#1e293b] border-white/15 text-white backdrop-blur-xl max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Editar Projeto</DialogTitle>
            </DialogHeader>
            {editingProject && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Nome do Projeto</label>
                  <Input 
                    placeholder="Ex: Dashboard E-commerce" 
                    className="bg-white/5 border-white/15 focus:border-[#00f2ff]"
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({...editingProject, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Descrição</label>
                  <Input 
                    placeholder="O que este projeto faz?" 
                    className="bg-white/5 border-white/15 focus:border-[#00f2ff]"
                    value={editingProject.description || ''}
                    onChange={(e) => setEditingProject({...editingProject, description: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Link (Opcional)</label>
                  <Input 
                    placeholder="https://..." 
                    className="bg-white/5 border-white/15 focus:border-[#00f2ff]"
                    value={editingProject.link || ''}
                    onChange={(e) => setEditingProject({...editingProject, link: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Status</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['in-progress', 'ready', 'site'] as ProjectStatus[]).map((s) => (
                      <Button
                        key={s}
                        variant={editingProject.status === s ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setEditingProject({...editingProject, status: s})}
                        className={cn(
                          "capitalize text-[10px] sm:text-xs px-1",
                          editingProject.status === s ? "bg-[#00f2ff] text-black" : "border-white/15 text-white/60"
                        )}
                      >
                        {s.replace('-', ' ')}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white/60">Exposição Pública</label>
                  <div className="flex items-center gap-4 bg-white/5 p-3 rounded-xl border border-white/10">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                      editingProject.isPublic ? "bg-[#00f2ff]/20 text-[#00f2ff]" : "bg-white/10 text-white/40"
                    )}>
                      {editingProject.isPublic ? <Eye size={20} /> : <EyeOff size={20} />}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-bold">{editingProject.isPublic ? "Público" : "Privado"}</div>
                      <div className="text-[10px] text-white/40">
                        {editingProject.isPublic ? "Todos podem ver este projeto na Exposição" : "Apenas você pode ver este projeto"}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setEditingProject({...editingProject, isPublic: !editingProject.isPublic})}
                      className="border-white/15 text-xs"
                    >
                      Alterar
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} className="text-white/60">Cancelar</Button>
              <Button onClick={handleUpdateProject} className="bg-[#00f2ff] text-black hover:bg-[#00f2ff]/80">Atualizar Projeto</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Comments Dialog */}
        <Dialog open={isCommentsDialogOpen} onOpenChange={setIsCommentsDialogOpen}>
          <DialogContent className="bg-[#1e293b] border-white/15 text-white backdrop-blur-xl max-w-[95vw] sm:max-w-2xl h-[80vh] flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b border-white/10">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                <MessageSquare className="text-[#00f2ff]" /> 
                {selectedProjectForComments?.name}
              </DialogTitle>
              <DialogDescription className="text-white/40">
                Deixe suas ideias, sugestões ou entre em contato com o desenvolvedor.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 flex flex-col min-h-0">
              {user?.uid === selectedProjectForComments?.userId ? (
                <ScrollArea className="flex-1 p-6">
                  <div className="space-y-6">
                    {comments.length === 0 ? (
                      <div className="text-center py-10 text-white/20">
                        <MessageSquare size={48} className="mx-auto mb-4 opacity-10" />
                        <p>Nenhum comentário ainda. Seja o primeiro a dar uma ideia!</p>
                      </div>
                    ) : (
                      comments.map((comment) => (
                        <div key={comment.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
                          <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#00f2ff]/20 text-[#00f2ff] flex items-center justify-center text-[10px] font-bold">
                                {comment.authorName.charAt(0)}
                              </div>
                              <span className="text-xs font-bold text-white/80">{comment.authorName}</span>
                              {comment.contact && (
                                <span className="text-[10px] text-white/40 flex items-center gap-1">
                                  <Phone size={10} /> {comment.contact}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-white/20">
                              {comment.createdAt?.toDate().toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-sm text-white/70 leading-relaxed">{comment.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex-1 flex items-center justify-center p-10 text-center">
                  <div className="max-w-xs space-y-4">
                    <div className="w-16 h-16 bg-[#00f2ff]/10 rounded-full flex items-center justify-center mx-auto">
                      <MessageSquare className="text-[#00f2ff]" size={32} />
                    </div>
                    <h4 className="text-lg font-bold">Deixe sua Sugestão</h4>
                    <p className="text-sm text-white/40">
                      Suas ideias são enviadas diretamente para o desenvolvedor do projeto. Somente ele pode visualizá-las.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-6 border-t border-white/10 bg-black/20 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                    <Input 
                      placeholder="Seu nome" 
                      className="bg-white/5 border-white/15 pl-9 text-xs"
                      value={newComment.authorName}
                      onChange={(e) => setNewComment({...newComment, authorName: e.target.value})}
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                    <Input 
                      placeholder="Contato (opcional)" 
                      className="bg-white/5 border-white/15 pl-9 text-xs"
                      value={newComment.contact}
                      onChange={(e) => setNewComment({...newComment, contact: e.target.value})}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input 
                    placeholder="Sua ideia ou comentário..." 
                    className="bg-white/5 border-white/15 text-xs flex-1"
                    value={newComment.content}
                    onChange={(e) => setNewComment({...newComment, content: e.target.value})}
                  />
                  <Button 
                    onClick={handleAddComment}
                    className="bg-[#00f2ff] text-black hover:bg-[#00f2ff]/80 font-bold"
                  >
                    <Send size={16} />
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
