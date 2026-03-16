import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  RefreshCcw,
  Check,
  X,
  Calendar,
  Clock,
  Barcode,
  Plus,
  Minus,
  Save,
  Home,
  History,
  Settings,
  BarChart3,
  Database,
  Pin,
  FileText,
  Package2,
  Construction,
  Palette,
  Ruler,
  Trash2,
  Edit2,
  Share2,
  Table as TableIcon,
  Search,
  Filter,
  Cloud,
  MessageCircle,
  Download,
  Smartphone,
  Mail
} from 'lucide-react';
import { SKU, Entry, Tab } from './types';

interface ApontamentoScreenProps {
  successMessage: boolean;
  setSuccessMessage: (val: boolean) => void;
  date: string;
  setDate: (val: string) => void;
  shift: string;
  setShift: (val: string) => void;
  selectedSkuId: number | '';
  setSelectedSkuId: (val: number | '') => void;
  skus: SKU[];
  carNumber: string;
  setCarNumber: (val: string) => void;
  quantity: number | '';
  setQuantity: React.Dispatch<React.SetStateAction<number | ''>>;
  handleSaveEntry: () => Promise<void>;
}

interface ConsultaScreenProps {
  fetchData: () => Promise<void>;
  dateInputRef: React.RefObject<HTMLInputElement>;
  filterDate: string | null;
  setFilterDate: (val: string | null) => void;
  showShiftModal: boolean;
  setShowShiftModal: (val: boolean) => void;
  filterShift: string;
  setFilterShift: (val: string) => void;
  entries: Entry[];
  filteredEntries: Entry[];
  shiftMap: Record<string, string>;
  showAllEntries: boolean;
  setShowAllEntries: (val: boolean) => void;
  setSuccessMessage: (val: boolean) => void;
  skus: SKU[];
  setSelectedEntryForDetails: (entry: Entry | null) => void;
  filterSkuId: number | 'Todos';
  setFilterSkuId: (val: number | 'Todos') => void;
  showSkuModal: boolean;
  setShowSkuModal: (val: boolean) => void;
}

interface SKUManagerScreenProps {
  skus: SKU[];
  skuSearch: string;
  setSkuSearch: (val: string) => void;
  handleDeleteSku: (id: number) => Promise<void>;
  setEditingSkuId: (val: number | null) => void;
  setNewSkuName: (val: string) => void;
  setNewSkuFase: (val: string) => void;
  setShowAddSkuModal: (val: boolean) => void;
  showAddSkuModal: boolean;
  editingSkuId: number | null;
  newSkuName: string;
  newSkuFase: string;
  handleSaveSku: () => Promise<void>;
}

interface ReportsScreenProps {
  setActiveTab: (val: Tab) => void;
  reportStartDateRef: React.RefObject<HTMLInputElement | null>;
  reportStartDate: string;
  setReportStartDate: (val: string) => void;
  reportEndDateRef: React.RefObject<HTMLInputElement | null>;
  reportEndDate: string;
  setReportEndDate: (val: string) => void;
  entries: Entry[];
  shiftMap: Record<string, string>;
  handleExportExcel: () => void;
  handleShareReport: () => void;
  isSharing: boolean;
  reportShift: string;
  setReportShift: (val: string) => void;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('apontar');
  const [skus, setSkus] = useState<SKU[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState({ total: 0 });
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState(false);

  // Form State
  const [selectedSkuId, setSelectedSkuId] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState('A');
  const [carNumber, setCarNumber] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');

  // Filter State
  const [filterDate, setFilterDate] = useState<string | null>(null);
  const [filterShift, setFilterShift] = useState<string>('Todos');
  const [filterSkuId, setFilterSkuId] = useState<number | 'Todos'>('Todos');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showSkuModal, setShowSkuModal] = useState(false);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const reportStartDateRef = useRef<HTMLInputElement>(null);
  const reportEndDateRef = useRef<HTMLInputElement>(null);

  // Reports State
  const [reportStartDate, setReportStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportEndDate, setReportEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [reportShift, setReportShift] = useState<string>('Todos');
  const [isSharing, setIsSharing] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // SKU Management State
  const [skuSearch, setSkuSearch] = useState('');
  const [showAddSkuModal, setShowAddSkuModal] = useState(false);
  const [editingSkuId, setEditingSkuId] = useState<number | null>(null);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [selectedEntryForDetails, setSelectedEntryForDetails] = useState<Entry | null>(null);

  const [newSkuName, setNewSkuName] = useState('');
  const [newSkuFase, setNewSkuFase] = useState('');

  const filteredEntries = React.useMemo(() => {
    return entries.filter(e =>
      (!filterDate || e.date === filterDate) &&
      (filterShift === 'Todos' || e.shift === filterShift) &&
      (filterSkuId === 'Todos' || e.sku_id === filterSkuId)
    );
  }, [entries, filterDate, filterShift, filterSkuId]);

  const totalQuantity = React.useMemo(() => {
    return filteredEntries.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [filteredEntries]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchSkus = async () => {
    const res = await fetch('/api/skus');
    setSkus(await res.json());
  };

  const shiftMap: Record<string, string> = {
    '1º Turno': 'A',
    '2º Turno': 'B',
    '3º Turno': 'C',
    'A': 'A',
    'B': 'B',
    'C': 'C'
  };

  const fetchData = async () => {
    try {
      const [skusRes, entriesRes, statsRes] = await Promise.all([
        fetch('/api/skus'),
        fetch('/api/entries'),
        fetch('/api/stats')
      ]);
      const [skusData, entriesData, statsData] = await Promise.all([
        skusRes.json(),
        entriesRes.json(),
        statsRes.json()
      ]);
      setSkus(skusData);
      setEntries(entriesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!selectedSkuId) {
      alert('Por favor, selecione um SKU antes de salvar.');
      return;
    }

    if (quantity === '' || quantity <= 0) {
      alert('Por favor, digite uma quantidade válida.');
      return;
    }

    try {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku_id: selectedSkuId,
          date,
          shift,
          car_number: carNumber,
          quantity
        })
      });

      if (res.ok) {
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
        fetchData();
        // Reset form partially
        setCarNumber('');
        setQuantity('');
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await res.json();
          alert(`Erro ao salvar registro: ${errorData.error || 'Erro desconhecido'}`);
        } else {
          const text = await res.text();
          console.error('Server error response:', res.status, text);
          alert(`Erro no servidor ao salvar registro (${res.status}). Verifique o console ou logs do Vercel.`);
        }
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Erro de conexão ao salvar registro.');
    }
  };

  const handleSaveSku = async () => {
    if (!newSkuName) {
      alert('Por favor, digite o nome do SKU.');
      return;
    }

    try {
      const url = editingSkuId ? `/api/skus/${editingSkuId}` : '/api/skus';
      const method = editingSkuId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newSkuName,
          fase: newSkuFase
        })
      });

      if (res.ok) {
        setShowAddSkuModal(false);
        setEditingSkuId(null);
        setNewSkuName('');
        setNewSkuFase('');
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
        fetchData(); // Use fetchData to update everything
      } else {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const errorData = await res.json();
          alert(`Erro ao salvar SKU: ${errorData.error || 'Erro desconhecido'}`);
        } else {
          const text = await res.text();
          console.error('Server error response:', res.status, text);
          alert(`Erro no servidor ao salvar SKU (${res.status}). Verifique o console ou logs do Vercel.`);
        }
      }
    } catch (error) {
      console.error('Error saving SKU:', error);
      alert('Erro de conexão ao salvar SKU.');
    }
  };

  const handleDeleteSku = async (id: number) => {
    if (!window.confirm('Deseja excluir este SKU? Isso pode afetar registros existentes.')) return;

    try {
      const res = await fetch(`/api/skus/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
        fetchSkus();
      }
    } catch (error) {
      console.error('Error deleting SKU:', error);
    }
  };

  const handleExportExcel = () => {
    const filteredEntries = entries.filter(e => 
      e.date >= reportStartDate && 
      e.date <= reportEndDate && 
      (reportShift === 'Todos' || e.shift === reportShift)
    );

    if (filteredEntries.length === 0) {
      alert('Nenhum dado encontrado para o período selecionado.');
      return;
    }

    const { wb, fileName } = generateReportExcel(filteredEntries, reportStartDate, reportEndDate);
    XLSX.writeFile(wb, fileName);

    setSuccessMessage(true);
    setTimeout(() => setSuccessMessage(false), 3000);
  };

  const generateReportExcel = (filteredEntries: Entry[], startDate: string, endDate: string) => {
    const dataToExport = filteredEntries.map(e => ({
      'Data': new Date(e.date + 'T12:00:00').toLocaleDateString('pt-BR'),
      'SKU': e.sku_name,
      'Fase': e.fase || '-',
      'Turno': shiftMap[e.shift] || e.shift,
      'Carro': e.car_number,
      'Quantidade': e.quantity
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Produção');

    const fileName = `Producao_${startDate}_ate_${endDate}.xlsx`;
    return { wb, fileName };
  };

  const handleShareReport = async () => {
    const filteredEntries = entries.filter(e => 
      e.date >= reportStartDate && 
      e.date <= reportEndDate && 
      (reportShift === 'Todos' || e.shift === reportShift)
    );

    if (filteredEntries.length === 0) {
      alert('Nenhum dado encontrado para o período selecionado.');
      return;
    }

    setShowShareModal(true);
  };

  const confirmShare = async (method: 'whatsapp' | 'email' | 'system' | 'download') => {
    const filteredEntries = entries.filter(e => 
      e.date >= reportStartDate && 
      e.date <= reportEndDate && 
      (reportShift === 'Todos' || e.shift === reportShift)
    );

    if (filteredEntries.length === 0) return;

    // Generate everything BEFORE state changes to keep user activation "fresh"
    const { wb, fileName } = generateReportExcel(filteredEntries, reportStartDate, reportEndDate);
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const file = new File([new Blob([wbout], { type: mimeType })], fileName, { type: mimeType });

    if (method === 'download') {
      setShowShareModal(false);
      XLSX.writeFile(wb, fileName);
      return;
    }

    try {
      // Check for navigator.share BEFORE any awaits or state changes
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        setShowShareModal(false);
        setIsSharing(true);

        await navigator.share({
          files: [file],
          title: 'Relatório de Produção',
          text: `Relatório de Produção (${reportStartDate} a ${reportEndDate})`
        });
      } else {
        // Advanced Fallback for non-supporting browsers (like Desktop Chrome/Windows)
        setShowShareModal(false);
        XLSX.writeFile(wb, fileName);

        if (method === 'whatsapp') {
          const text = encodeURIComponent(`Segue o Relatório de Produção (${reportStartDate} até ${reportEndDate}). O arquivo excel já foi baixado no seu dispositivo.`);
          window.open(`https://wa.me/?text=${text}`, '_blank');
        } else if (method === 'email') {
          const subject = encodeURIComponent('Relatório de Produção');
          const body = encodeURIComponent(`Olá, segue em anexo o relatório de produção do período ${reportStartDate} até ${reportEndDate}.\n\n(O arquivo foi baixado automaticamente na sua pasta de Downloads)`);
          window.location.href = `mailto:?subject=${subject}&body=${body}`;
        } else {
          alert('Este dispositivo não permite compartilhar arquivos diretamente. O relatório foi baixado com sucesso! 😊');
        }
      }
    } catch (error: any) {
      console.error('Sharing Error:', error);
      setShowShareModal(false);
      
      if (error.name === 'AbortError') return;

      // Handle Permission Denied (NotAllowedError) or other blocks
      const { wb: wbError, fileName: fnError } = generateReportExcel(filteredEntries, reportStartDate, reportEndDate);
      XLSX.writeFile(wbError, fnError);

      if (method === 'whatsapp') {
        const text = encodeURIComponent(`Relatório de Produção (${reportStartDate} até ${reportEndDate}). O arquivo excel já está nos seus downloads.`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
      } else if (method === 'email') {
        const subject = encodeURIComponent('Relatório de Produção');
        const body = encodeURIComponent(`Olá, segue o relatório de produção (${reportStartDate} a ${reportEndDate}). O arquivo excel já está nos seus downloads.`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
      } else {
        alert('O navegador bloqueou o compartilhamento direto por segurança. O relatório foi baixado e você pode enviá-lo manualmente! ✅');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'apontar': return (
        <ApontamentoScreen
          successMessage={successMessage}
          setSuccessMessage={setSuccessMessage}
          date={date}
          setDate={setDate}
          shift={shift}
          setShift={setShift}
          selectedSkuId={selectedSkuId}
          setSelectedSkuId={setSelectedSkuId}
          skus={skus}
          carNumber={carNumber}
          setCarNumber={setCarNumber}
          quantity={quantity}
          setQuantity={setQuantity}
          handleSaveEntry={handleSaveEntry}
        />
      );
      case 'consulta': return (
        <ConsultaScreen
          fetchData={fetchData}
          dateInputRef={dateInputRef}
          filterDate={filterDate}
          setFilterDate={setFilterDate}
          showShiftModal={showShiftModal}
          setShowShiftModal={setShowShiftModal}
          filterShift={filterShift}
          setFilterShift={setFilterShift}
          entries={entries}
          filteredEntries={filteredEntries}
          shiftMap={shiftMap}
          showAllEntries={showAllEntries}
          setShowAllEntries={setShowAllEntries}
          setSuccessMessage={setSuccessMessage}
          skus={skus}
          setSelectedEntryForDetails={setSelectedEntryForDetails}
          filterSkuId={filterSkuId}
          setFilterSkuId={setFilterSkuId}
          showSkuModal={showSkuModal}
          setShowSkuModal={setShowSkuModal}
        />
      );
      case 'skus': return (
        <SKUManagerScreen
          skus={skus}
          skuSearch={skuSearch}
          setSkuSearch={setSkuSearch}
          handleDeleteSku={handleDeleteSku}
          setEditingSkuId={setEditingSkuId}
          setNewSkuName={setNewSkuName}
          setNewSkuFase={setNewSkuFase}
          setShowAddSkuModal={setShowAddSkuModal}
          showAddSkuModal={showAddSkuModal}
          editingSkuId={editingSkuId}
          newSkuName={newSkuName}
          newSkuFase={newSkuFase}
          handleSaveSku={handleSaveSku}
        />
      );
      case 'relatorios': return (
        <ReportsScreen
          setActiveTab={setActiveTab}
          reportStartDateRef={reportStartDateRef}
          reportStartDate={reportStartDate}
          setReportStartDate={setReportStartDate}
          reportEndDateRef={reportEndDateRef}
          reportEndDate={reportEndDate}
          setReportEndDate={setReportEndDate}
          entries={entries}
          shiftMap={shiftMap}
          handleExportExcel={handleExportExcel}
          handleShareReport={handleShareReport}
          isSharing={isSharing}
          reportShift={reportShift}
          setReportShift={setReportShift}
        />
      );
      default: return (
        <ApontamentoScreen
          successMessage={successMessage}
          setSuccessMessage={setSuccessMessage}
          date={date}
          setDate={setDate}
          shift={shift}
          setShift={setShift}
          selectedSkuId={selectedSkuId}
          setSelectedSkuId={setSelectedSkuId}
          skus={skus}
          carNumber={carNumber}
          setCarNumber={setCarNumber}
          quantity={quantity}
          setQuantity={setQuantity}
          handleSaveEntry={handleSaveEntry}
        />
      );
    }
  };


  return (
    <div className="bg-black text-white min-h-screen flex flex-col max-w-md mx-auto relative overflow-hidden font-sans">
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="sticky bottom-0 bg-black/90 backdrop-blur-md border-t border-zinc-800 px-6 pb-8 pt-3 flex items-center justify-around z-30">
        <button
          onClick={() => setActiveTab('apontar')}
          className={`flex flex-col items-center gap-1 transition-opacity ${activeTab === 'apontar' ? 'text-white' : 'text-zinc-500'}`}
        >
          <Home size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider notranslate">Início</span>
        </button>
        <button
          onClick={() => setActiveTab('consulta')}
          className={`flex flex-col items-center gap-1 transition-opacity ${activeTab === 'consulta' ? 'text-white' : 'text-zinc-500'}`}
        >
          <BarChart3 size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Consulta</span>
        </button>
        <button
          onClick={() => setActiveTab('skus')}
          className={`flex flex-col items-center gap-1 transition-opacity ${activeTab === 'skus' ? 'text-white' : 'text-zinc-500'}`}
        >
          <Package2 size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">SKUs</span>
        </button>
        <button
          onClick={() => setActiveTab('relatorios')}
          className={`flex flex-col items-center gap-1 transition-opacity ${activeTab === 'relatorios' ? 'text-white' : 'text-zinc-500'}`}
        >
          <FileText size={24} />
          <span className="text-[10px] font-medium uppercase tracking-wider">Relatórios</span>
        </button>
      </nav>

      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-zinc-800 rounded-full"></div>
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        onShare={confirmShare}
      />

      <AnimatePresence>
        {selectedEntryForDetails && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedEntryForDetails(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl z-[110] p-6 pb-12 max-w-md mx-auto border-t border-white/10"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">
                    Detalhes do Lançamento
                  </h3>
                  <p className="text-zinc-400 text-xs font-bold uppercase tracking-widest">
                    ID #{selectedEntryForDetails.id}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedEntryForDetails(null)}
                  className="p-2 -mr-2 text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800/50 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Data</p>
                    <div className="flex items-center gap-2">
                       <Calendar size={14} className="text-blue-500" />
                       <p className="text-white font-bold">{new Date(selectedEntryForDetails.date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Turno</p>
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-blue-500" />
                      <p className="text-white font-bold">Turno {selectedEntryForDetails.shift}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800/50 p-4 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">SKU / Produto</p>
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-zinc-800 flex items-center justify-center text-blue-500 shrink-0">
                      <Package2 size={20} />
                    </div>
                    <div>
                      <p className="text-white font-bold notranslate">{selectedEntryForDetails.sku_name}</p>
                      <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-tight notranslate">{selectedEntryForDetails.fase || 'Produção'}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800/50 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Nº do Carro</p>
                    <div className="flex items-center gap-2">
                      <Construction size={14} className="text-blue-500" />
                      <p className="text-white font-black text-lg">{selectedEntryForDetails.car_number || '-'}</p>
                    </div>
                  </div>
                  <div className="bg-zinc-800/50 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Quantidade</p>
                    <div className="flex items-center gap-2">
                      <BarChart3 size={14} className="text-blue-500" />
                      <p className="text-white font-black text-xl">{selectedEntryForDetails.quantity} <span className="text-[10px] font-bold text-zinc-500 uppercase ml-0.5">peças</span></p>
                    </div>
                  </div>
                </div>

                <div className="bg-black/30 p-3 rounded-xl border border-zinc-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                    <Clock size={12} className="opacity-50" />
                    Registrado em
                  </div>
                  <p className="text-zinc-400 text-[10px] font-bold">
                    {new Date(selectedEntryForDetails.timestamp).toLocaleString('pt-BR')}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedEntryForDetails(null)}
                  className="w-full h-14 bg-zinc-800 text-white rounded-xl font-bold mt-4 active:scale-95 transition-transform"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}



const ApontamentoScreen = ({
  successMessage, setSuccessMessage, date, setDate, shift, setShift,
  selectedSkuId, setSelectedSkuId, skus, carNumber, setCarNumber,
  quantity, setQuantity, handleSaveEntry
}: ApontamentoScreenProps) => (
  <div className="flex flex-col h-full">
    <header className="flex items-center justify-between px-4 pt-12 pb-4 border-b border-zinc-800 sticky top-0 bg-black/80 backdrop-blur-md z-20">
      <button className="p-2 -ml-2 text-white">
        <ChevronLeft size={24} />
      </button>
      <h1 className="text-lg font-bold tracking-tight text-white text-center flex-1 uppercase">Apontamento</h1>
      <div className="w-10 flex justify-end">
        <RefreshCcw size={16} className="text-zinc-500" />
      </div>
    </header>

    <AnimatePresence>
      {successMessage && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="px-4 pt-4"
        >
          <div className="flex items-center justify-between gap-4 rounded-xl bg-emerald-900/80 p-4 border border-emerald-900/30">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 text-white rounded-full p-1 flex items-center justify-center">
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <p className="text-white text-sm font-bold leading-tight">Sucesso!</p>
                <p className="text-emerald-50 text-xs font-normal opacity-90">Registro salvo com sucesso!</p>
              </div>
            </div>
            <button onClick={() => setSuccessMessage(false)} className="text-white/40 hover:text-white">
              <X size={18} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    <main className="flex-1 px-4 py-6 space-y-6 overflow-y-auto">
      <div className="space-y-1.5">
        <label className="text-[13px] font-semibold text-zinc-400 ml-1 uppercase tracking-wider">Data</label>
        <div className="relative flex items-center">
          <input
            className="w-full h-12 bg-zinc-900 border-none rounded-xl px-4 text-white focus:ring-2 focus:ring-blue-500 appearance-none"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Calendar size={18} className="absolute right-4 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-semibold text-zinc-400 ml-1 uppercase tracking-wider">Turno</label>
        <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-900 rounded-xl">
          {['A', 'B', 'C'].map((t) => (
            <button
              key={t}
              onClick={() => setShift(t)}
              className={`h-10 rounded-lg flex items-center justify-center text-sm font-semibold transition-all notranslate ${shift === t ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-semibold text-zinc-400 ml-1 uppercase tracking-wider">SKU</label>
        <div className="relative flex items-center">
          <select
            className="w-full h-12 bg-zinc-900 border-none rounded-xl px-4 text-white focus:ring-2 focus:ring-blue-500 appearance-none notranslate"
            value={selectedSkuId}
            onChange={(e) => setSelectedSkuId(Number(e.target.value))}
          >
            <option value="" disabled className="notranslate">Selecione um SKU</option>
            {skus.map(sku => (
              <option key={sku.id} value={sku.id} className="notranslate">{sku.name}</option>
            ))}
          </select>
          <Barcode size={18} className="absolute right-4 text-zinc-500 pointer-events-none" />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-semibold text-zinc-400 ml-1 uppercase tracking-wider">Nº do Carro</label>
        <input
          className="w-full h-12 bg-zinc-900 border-none rounded-xl px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-blue-500"
          placeholder="Digite o número"
          type="text"
          value={carNumber}
          onChange={(e) => setCarNumber(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-[13px] font-semibold text-zinc-400 ml-1 uppercase tracking-wider">Quantidade de Peças</label>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setQuantity(prev => Math.max(0, (typeof prev === 'number' ? prev : 0) - 1))}
            className="size-12 rounded-xl bg-zinc-800 text-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <Minus size={20} strokeWidth={3} />
          </button>
          <input
            className="flex-1 h-12 text-center text-xl font-bold bg-zinc-900 border-none rounded-xl text-white focus:ring-2 focus:ring-blue-500"
            type="number"
            placeholder="0"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <button
            onClick={() => setQuantity(prev => (typeof prev === 'number' ? prev : 0) + 1)}
            className="size-12 rounded-xl bg-zinc-800 text-white flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus size={20} strokeWidth={3} />
          </button>
        </div>
      </div>
    </main>

    <footer className="p-4 pb-10 space-y-6 bg-black border-t border-zinc-800">
      <button
        onClick={handleSaveEntry}
        className="w-full h-14 bg-blue-600 text-white rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:opacity-90 transition-all shadow-lg shadow-blue-500/20"
      >
        <Save size={20} />
        Salvar Registro
      </button>
    </footer>
  </div >
);

const ConsultaScreen = ({
  fetchData, dateInputRef, filterDate, setFilterDate,
  showShiftModal, setShowShiftModal, filterShift, setFilterShift,
  entries, filteredEntries, shiftMap, showAllEntries, setShowAllEntries,
  setSuccessMessage, skus, setSelectedEntryForDetails,
  filterSkuId, setFilterSkuId, showSkuModal, setShowSkuModal
}: ConsultaScreenProps) => {
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editSkuId, setEditSkuId] = useState<number | ''>('');
  const [editDate, setEditDate] = useState('');
  const [editShift, setEditShift] = useState('A');
  const [editCarNumber, setEditCarNumber] = useState('');
  const [editQuantity, setEditQuantity] = useState<number | ''>('');

  const handleEditEntryClick = (entry: Entry) => {
    setEditingEntryId(entry.id);
    setEditSkuId(entry.sku_id);
    setEditDate(entry.date);
    setEditShift(entry.shift);
    setEditCarNumber(entry.car_number);
    setEditQuantity(entry.quantity);
  };

  const handleSaveEditEntry = async () => {
    if (!editSkuId || !editDate || editQuantity === '' || editQuantity <= 0) {
      alert('Por favor, preencha a Data, SKU e uma quantidade válida.');
      return;
    }

    try {
      const res = await fetch(`/api/entries/${editingEntryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku_id: editSkuId,
          date: editDate,
          shift: editShift,
          car_number: editCarNumber,
          quantity: editQuantity
        })
      });

      if (res.ok) {
        setEditingEntryId(null);
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
        fetchData();
      } else {
        alert('Erro ao salvar edição.');
      }
    } catch (error) {
      console.error('Error updating entry:', error);
      alert('Erro de conexão ao salvar edição.');
    }
  };
  const handleDeleteEntry = async (id: number) => {
    if (!window.confirm('Deseja realmente excluir este apontamento?')) return;

    try {
      const res = await fetch(`/api/entries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
        fetchData();
      } else {
        alert('Erro ao excluir apontamento.');
      }
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Erro de conexão ao excluir apontamento.');
    }
  };

  const totalQuantity = filteredEntries.reduce((acc, curr) => acc + curr.quantity, 0);
  const displayedEntries = showAllEntries ? filteredEntries : filteredEntries.slice(0, 10);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="sticky top-0 z-30 bg-black/80 backdrop-blur-md border-b border-zinc-800 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-blue-500" size={24} />
            <h1 className="text-2xl font-bold tracking-tight text-white">Consulta</h1>
          </div>
          <button onClick={fetchData} className="flex items-center justify-center size-9 rounded-full bg-zinc-900 active:opacity-60 transition-opacity">
            <RefreshCcw size={18} className="text-blue-500" />
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          <div className="relative">
            <input
              type="date"
              ref={dateInputRef}
              className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
              onChange={(e) => setFilterDate(e.target.value)}
            />
            <button
              onClick={() => dateInputRef.current?.showPicker()}
              className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full px-4 active:scale-95 transition-transform ${filterDate ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-zinc-900 border border-zinc-800 text-zinc-400'}`}
            >
              <Calendar size={16} />
              <p className="text-sm font-semibold">{filterDate ? new Date(filterDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'Data'}</p>
            </button>
          </div>
          <button
            onClick={() => setShowShiftModal(true)}
            className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full border px-4 active:scale-95 transition-transform ${filterShift !== 'Todos' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-500 shadow-lg shadow-emerald-500/10' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
          >
            <Clock size={16} />
            <p className="text-sm font-semibold">{filterShift === 'Todos' ? 'Turno' : `Turno ${filterShift}`}</p>
          </button>
          <button
            onClick={() => setShowSkuModal(true)}
            className={`flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full border px-4 active:scale-95 transition-transform ${filterSkuId !== 'Todos' ? 'border-blue-500/30 bg-blue-500/15 text-blue-500 shadow-lg shadow-blue-500/10' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}
          >
            <Barcode size={16} />
            <p className="text-sm font-semibold truncate max-w-[100px]">
              {filterSkuId === 'Todos' ? 'SKU' : skus.find(s => s.id === filterSkuId)?.name || 'SKU'}
            </p>
          </button>
          <button
            onClick={() => {
              setFilterDate(null);
              setFilterShift('Todos');
              setFilterSkuId('Todos');
            }}
            className="flex h-9 shrink-0 items-center justify-center gap-x-2 rounded-full bg-zinc-900 border border-zinc-800 px-4 text-zinc-400 active:scale-95 transition-transform"
          >
            <Filter size={16} className={filterDate || filterShift !== 'Todos' || filterSkuId !== 'Todos' ? 'text-blue-500' : ''} />
            <p className="text-sm font-medium">Limpar</p>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 space-y-8 overflow-y-auto">
        <section className="relative">
          <div className="relative overflow-hidden flex flex-col items-start justify-center rounded-2xl p-6 bg-zinc-900 border-2 border-blue-500/40 shadow-[0_0_20px_rgba(10,132,255,0.15)]">
            <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
            <div className="flex items-center gap-2 mb-2">
              <Database size={16} className="text-blue-500" />
              <p className="text-blue-500 font-bold text-xs uppercase tracking-widest">Total Acumulado</p>
            </div>
            <div className="flex items-baseline gap-2">
              <h2 className="text-5xl font-black tracking-tighter text-white">
                {totalQuantity.toLocaleString()}
              </h2>
              <span className="text-lg font-semibold text-zinc-400">peças</span>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[11px] font-medium text-zinc-500 bg-black/30 px-3 py-1.5 rounded-full border border-zinc-800">
              <Check size={14} className="text-green-500" />
              <span>Sincronizado com Banco de Dados</span>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-lg font-bold text-white">Lançamentos Recentes</h3>
            {filteredEntries.length > 10 && (
              <button
                onClick={() => setShowAllEntries(!showAllEntries)}
                className="text-blue-500 text-sm font-semibold active:opacity-70"
              >
                {showAllEntries ? 'Ver Menos' : 'Ver Tudo'}
              </button>
            )}
          </div>

          {filteredEntries.length > 0 ? (
            <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 bg-white/5 notranslate gap-2">
                <div>DATA</div>
                <div>SKU</div>
                <div className="text-center">TURNO</div>
                <div className="text-right">QTD.</div>
                <div className="w-14"></div>
              </div>
              <div className="divide-y divide-zinc-800 max-h-64 overflow-y-auto no-scrollbar">
                {displayedEntries.map((entry) => (
                  <div 
                    key={entry.id} 
                    onClick={() => setSelectedEntryForDetails(entry)}
                    className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] items-center px-5 py-4 active:bg-zinc-800 hover:bg-zinc-800/50 cursor-pointer transition-colors gap-2"
                  >
                    <div className="text-xs font-bold text-zinc-400">
                      {new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </div>
                    <div className="text-sm font-bold text-white truncate pr-2 notranslate">{entry.sku_name}</div>
                    <div className="flex justify-center">
                      <div className="text-xs font-bold text-blue-500 bg-blue-500/10 w-fit px-2 py-0.5 rounded notranslate">
                        {shiftMap[entry.shift] || entry.shift}
                      </div>
                    </div>
                    <div className="text-right text-blue-500 font-bold text-base">{entry.quantity}</div>
                    <div className="w-14 flex justify-end gap-1">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditEntryClick(entry);
                        }}
                        className="text-zinc-600 hover:text-blue-500 active:text-blue-600 transition-colors p-1"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEntry(entry.id);
                        }}
                        className="text-zinc-600 hover:text-red-500 active:text-red-600 transition-colors p-1"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/50 rounded-2xl border border-zinc-800/50 p-12 text-center">
              <Filter size={48} className="mx-auto text-zinc-700 mb-4 opacity-20" />
              <p className="text-zinc-500 font-medium">Nenhum registro encontrado para os filtros selecionados.</p>
            </div>
          )}

          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <BarChart3 size={18} className="text-blue-500" />
                Produtividade por Turno
              </h3>
              <span className="text-[10px] font-bold text-zinc-500 bg-black/40 px-2 py-1 rounded-md border border-zinc-800 italic">Total por Qtd.</span>
            </div>

            <div className="grid grid-cols-3 gap-6 items-end h-32 pt-2">
              {['A', 'B', 'C'].map((s) => {
                const shiftQuantity = filteredEntries
                  .filter(e => e.shift === s)
                  .reduce((acc, curr) => acc + curr.quantity, 0);

                const maxQuantity = Math.max(...['A', 'B', 'C'].map(shift =>
                  filteredEntries
                    .filter(e => e.shift === shift)
                    .reduce((acc, curr) => acc + curr.quantity, 0)
                ), 1);

                const percentage = (shiftQuantity / maxQuantity) * 100;

                return (
                  <div key={s} className="flex flex-col items-center gap-3 h-full justify-end group">
                    <div className="relative w-full flex flex-col items-center justify-end h-full">
                      {shiftQuantity > 0 && (
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${percentage}%` }}
                          className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg relative shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:from-blue-500 group-hover:to-blue-300 transition-all duration-500"
                        >
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white/10 shadow-sm shadow-black/50">
                            {shiftQuantity}
                          </div>
                        </motion.div>
                      )}
                      {shiftQuantity === 0 && (
                        <div className="w-full h-1 bg-zinc-800 rounded-full opacity-50"></div>
                      )}
                    </div>
                    <span className="text-xs font-black text-zinc-500 group-hover:text-blue-500 transition-colors uppercase">Turno {s}</span>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex items-center justify-center gap-4 text-[10px] text-zinc-500 font-medium">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span>Volume de Produção</span>
              </div>
              <div className="h-3 w-px bg-zinc-800"></div>
              <p>
                {filteredEntries.length} Registros
              </p>
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {showShiftModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShiftModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl z-50 p-6 pb-12 max-w-md mx-auto border-t border-white/10"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
              <h3 className="text-lg font-bold text-white mb-4 notranslate">Turno</h3>
              <div className="space-y-2">
                {['Todos', 'A', 'B', 'C'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setFilterShift(s);
                      setShowShiftModal(false);
                    }}
                    className={`w-full h-14 rounded-xl flex items-center justify-between px-5 transition-all notranslate ${filterShift === s ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                  >
                    <span className="font-semibold notranslate">{s}</span>
                    {filterShift === s && <Check size={20} />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSkuModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSkuModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl z-50 p-6 pb-12 max-w-md mx-auto border-t border-white/10"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
              <h3 className="text-lg font-bold text-white mb-4 notranslate">Filtrar SKU</h3>
              <div className="space-y-2 max-h-80 overflow-y-auto no-scrollbar pr-1">
                <button
                  onClick={() => {
                    setFilterSkuId('Todos');
                    setShowSkuModal(false);
                  }}
                  className={`w-full h-14 shrink-0 rounded-xl flex items-center justify-between px-5 transition-all ${filterSkuId === 'Todos' ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
                >
                  <span className="font-semibold notranslate">Todos os SKUs</span>
                  {filterSkuId === 'Todos' && <Check size={20} />}
                </button>
                {skus.map((sku) => (
                  <button
                    key={sku.id}
                    onClick={() => {
                      setFilterSkuId(sku.id);
                      setShowSkuModal(false);
                    }}
                    className={`w-full h-14 shrink-0 rounded-xl flex items-center justify-between px-5 transition-all notranslate ${filterSkuId === sku.id ? 'bg-blue-600 text-white' : 'bg-zinc-900/50 border border-white/5 text-zinc-400 hover:text-white'}`}
                  >
                    <div className="flex flex-col items-start overflow-hidden text-left">
                      <span className="font-semibold truncate w-full notranslate">{sku.name}</span>
                      <span className="text-[10px] uppercase font-bold opacity-50 notranslate">{sku.fase}</span>
                    </div>
                    {filterSkuId === sku.id && <Check size={20} className="shrink-0 ml-2" />}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editingEntryId !== null && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingEntryId(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl z-[60] p-6 pb-12 max-w-md mx-auto border-t border-white/10"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-bold text-white mb-6 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
                Editar Lançamento
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">Data</label>
                  <div className="relative flex items-center">
                    <input
                      className="w-full h-12 bg-zinc-800 border-none rounded-xl px-4 text-white focus:ring-2 focus:ring-blue-500 appearance-none"
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                    <Calendar size={18} className="absolute right-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">SKU</label>
                  <div className="relative flex items-center">
                    <select
                      className="w-full h-12 bg-zinc-800 border-none rounded-xl px-4 text-white focus:ring-2 focus:ring-blue-500 appearance-none notranslate"
                      value={editSkuId}
                      onChange={(e) => setEditSkuId(Number(e.target.value))}
                    >
                      <option value="" disabled className="notranslate">Selecione um SKU</option>
                      {skus.map(sku => (
                        <option key={sku.id} value={sku.id} className="notranslate">{sku.name}</option>
                      ))}
                    </select>
                    <Barcode size={18} className="absolute right-4 text-zinc-500 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">Turno</label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-zinc-800 rounded-xl">
                    {['A', 'B', 'C'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setEditShift(t)}
                        className={`h-10 rounded-lg flex items-center justify-center text-sm font-semibold transition-all notranslate ${editShift === t ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-500'}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">Nº do Carro</label>
                  <input
                    className="w-full h-12 bg-zinc-800 border-none rounded-xl px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-blue-500"
                    placeholder="Digite o número"
                    type="text"
                    value={editCarNumber}
                    onChange={(e) => setEditCarNumber(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">Quantidade de Peças</label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => setEditQuantity(prev => Math.max(0, (typeof prev === 'number' ? prev : 0) - 1))}
                      className="size-12 rounded-xl bg-zinc-800 text-white flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <Minus size={20} strokeWidth={3} />
                    </button>
                    <input
                      className="flex-1 h-12 text-center text-xl font-bold bg-zinc-800 border-none rounded-xl text-white focus:ring-2 focus:ring-blue-500"
                      type="number"
                      placeholder="0"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                    />
                    <button
                      onClick={() => setEditQuantity(prev => (typeof prev === 'number' ? prev : 0) + 1)}
                      className="size-12 rounded-xl bg-zinc-800 text-white flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <Plus size={20} strokeWidth={3} />
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => setEditingEntryId(null)}
                    className="flex-1 h-14 bg-zinc-800 text-white rounded-xl font-bold active:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEditEntry}
                    className="flex-[2] h-14 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const SKUManagerScreen = ({
  skus, skuSearch, setSkuSearch, handleDeleteSku, setEditingSkuId,
  setNewSkuName, setNewSkuFase, setShowAddSkuModal, showAddSkuModal,
  editingSkuId, newSkuName, newSkuFase, handleSaveSku
}: SKUManagerScreenProps) => {
  const filteredSkus = skus.filter(s =>
    s.name.toLowerCase().includes(skuSearch.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="sticky top-0 z-30 bg-black/90 backdrop-blur-md border-b border-white/10 px-4 pt-12 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Package2 className="text-white" size={24} />
            <h1 className="text-2xl font-bold tracking-tight">Gerenciamento de SKUs</h1>
          </div>
          <div className="flex items-center gap-2 text-zinc-500 text-xs">
            <Cloud size={14} />
            <span>Sincronizado</span>
          </div>
        </div>
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="text-zinc-400" size={18} />
          </div>
          <input
            className="block w-full pl-10 pr-3 py-2.5 bg-zinc-800 border-none rounded-xl text-sm text-white placeholder:text-zinc-400 focus:ring-1 focus:ring-blue-500 transition-all"
            placeholder="Buscar por nome ou código..."
            type="text"
            value={skuSearch}
            onChange={(e) => setSkuSearch(e.target.value)}
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6 pb-24">
        <div className="flex flex-col gap-3">
          {filteredSkus.map((sku) => (
            <div key={sku.id} className="bg-zinc-900 p-4 rounded-xl border border-white/5 flex items-center justify-between shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center text-white">
                  <Package2 size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-white notranslate">{sku.name}</h3>
                  <p className="text-sm text-zinc-400 uppercase tracking-tight text-[11px] font-bold notranslate">
                    {sku.fase}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingSkuId(sku.id);
                    setNewSkuName(sku.name);
                    setNewSkuFase(sku.fase);
                    setShowAddSkuModal(true);
                  }}
                  className="p-2 bg-zinc-800 rounded-full text-blue-500 active:opacity-60"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeleteSku(sku.id)}
                  className="p-2 bg-zinc-800 rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-500/10 active:scale-95 transition-all"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {filteredSkus.length === 0 && (
            <div className="py-20 text-center text-zinc-500">
              <Package2 className="mx-auto mb-4 opacity-20" size={48} />
              <p>Nenhum SKU encontrado</p>
            </div>
          )}
        </div>
      </main>

      <button
        onClick={() => setShowAddSkuModal(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-transform z-40"
      >
        <Plus size={32} />
      </button>

      <AnimatePresence>
        {showAddSkuModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowAddSkuModal(false);
                setEditingSkuId(null);
                setNewSkuName('');
                setNewSkuFase('');
              }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl z-[60] p-6 pb-12 max-w-md mx-auto border-t border-white/10"
            >
              <div className="w-12 h-1.5 bg-zinc-800 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-bold text-white mb-6">
                {editingSkuId ? 'Editar SKU' : 'Novo SKU'}
              </h3>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">Nome do Item</label>
                  <input
                    className="w-full h-12 bg-zinc-800 border-none rounded-xl px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-blue-500 notranslate"
                    placeholder="Nome do produto"
                    value={newSkuName}
                    onChange={(e) => setNewSkuName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-zinc-500 uppercase ml-1">Fase</label>
                  <input
                    className="w-full h-12 bg-zinc-800 border-none rounded-xl px-4 text-white placeholder:text-zinc-600 focus:ring-2 focus:ring-blue-500 notranslate"
                    placeholder="Ex: Almoxarifado, Pintura..."
                    value={newSkuFase}
                    onChange={(e) => setNewSkuFase(e.target.value)}
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={() => {
                      setShowAddSkuModal(false);
                      setEditingSkuId(null);
                      setNewSkuName('');
                      setNewSkuFase('');
                    }}
                    className="flex-1 h-14 bg-zinc-800 text-white rounded-xl font-bold active:opacity-60"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveSku}
                    className="flex-[2] h-14 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 active:scale-95 transition-transform"
                  >
                    {editingSkuId ? 'Salvar Alterações' : 'Salvar SKU'}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const ReportsScreen = ({
  setActiveTab, reportStartDateRef, reportStartDate, setReportStartDate,
  reportEndDateRef, reportEndDate, setReportEndDate, entries, shiftMap,
  handleExportExcel, handleShareReport, isSharing, reportShift, setReportShift
}: ReportsScreenProps) => (
  <div className="flex flex-col h-full overflow-hidden">
    <header className="flex items-center bg-black/80 backdrop-blur-md px-4 py-12 border-b border-white/10 sticky top-0 z-20">
      <button onClick={() => setActiveTab('apontar')} className="flex items-center justify-center p-2 -ml-2 rounded-full active:bg-white/10 transition-colors">
        <ChevronLeft className="text-blue-500" size={24} />
      </button>
      <h1 className="flex-1 text-center text-lg font-semibold tracking-tight">Exportar Relatórios</h1>
      <div className="w-10"></div>
    </header>

    <main className="flex-1 overflow-y-auto px-4 py-6 space-y-8 no-scrollbar">
      <section>
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-zinc-500 mb-2.5 px-1">Período de Exportação</h2>
        <div className="bg-zinc-900 rounded-2xl p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-zinc-500 font-semibold uppercase ml-1 notranslate">Início</label>
              <div className="relative">
                <input
                  type="date"
                  ref={reportStartDateRef}
                  className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
                  value={reportStartDate}
                  onChange={(e) => setReportStartDate(e.target.value)}
                />
                <button
                  onClick={() => reportStartDateRef.current?.showPicker()}
                  className="w-full flex items-center gap-2 bg-zinc-800 p-3.5 rounded-xl border border-white/5 active:scale-[0.98] transition-all"
                >
                  <Calendar className="text-blue-500" size={18} />
                  <span className="text-[15px] font-medium text-white notranslate">
                    {new Date(reportStartDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-zinc-500 font-semibold uppercase ml-1 notranslate">Fim</label>
              <div className="relative">
                <input
                  type="date"
                  ref={reportEndDateRef}
                  className="absolute inset-0 w-0 h-0 opacity-0 pointer-events-none"
                  value={reportEndDate}
                  onChange={(e) => setReportEndDate(e.target.value)}
                />
                <button
                  onClick={() => reportEndDateRef.current?.showPicker()}
                  className="w-full flex items-center gap-2 bg-zinc-800 p-3.5 rounded-xl border border-white/5 active:scale-[0.98] transition-all"
                >
                  <Calendar className="text-blue-500" size={18} />
                  <span className="text-[15px] font-medium text-white notranslate">
                    {new Date(reportEndDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] text-zinc-500 font-semibold uppercase ml-1">Turno</label>
            <div className="relative">
              <select 
                value={reportShift}
                onChange={(e) => setReportShift(e.target.value)}
                className="w-full appearance-none bg-zinc-800 p-3.5 rounded-xl border border-white/5 text-[15px] font-medium text-white focus:ring-1 focus:ring-blue-500/50 outline-none notranslate"
              >
                <option value="Todos">Todos</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
              <ChevronLeft className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500 rotate-270" size={18} />
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-[13px] font-medium uppercase tracking-wider text-zinc-500 mb-2.5 px-1">Produtividade por Turno</h2>
        <div className="bg-zinc-900 border border-white/5 rounded-2xl p-6 space-y-6 shadow-lg">
          <div className={`grid ${reportShift === 'Todos' ? 'grid-cols-3' : 'grid-cols-1 max-w-[120px] mx-auto'} gap-6 items-end h-32 pt-2`}>
            {['A', 'B', 'C']
              .filter(s => reportShift === 'Todos' || s === reportShift)
              .map((s) => {
                const shiftQuantity = entries
                  .filter(e => e.date >= reportStartDate && e.date <= reportEndDate && e.shift === s)
                  .reduce((acc, curr) => acc + curr.quantity, 0);

                const maxQuantity = Math.max(...['A', 'B', 'C'].map(shift =>
                  entries
                    .filter(e => e.date >= reportStartDate && e.date <= reportEndDate && e.shift === shift)
                    .reduce((acc, curr) => acc + curr.quantity, 0)
                ), 1);

                const percentage = (shiftQuantity / maxQuantity) * 100;

              return (
                <div key={s} className="flex flex-col items-center gap-3 h-full justify-end group">
                  <div className="relative w-full flex flex-col items-center justify-end h-full">
                    {shiftQuantity > 0 && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${percentage}%` }}
                        className="w-full bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-lg relative shadow-[0_0_15px_rgba(59,130,246,0.2)] group-hover:from-blue-500 group-hover:to-blue-300 transition-all duration-500"
                      >
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] font-black px-2 py-0.5 rounded-full border border-white/10 shadow-sm shadow-black/50">
                          {shiftQuantity}
                        </div>
                      </motion.div>
                    )}
                    {shiftQuantity === 0 && (
                      <div className="w-full h-1 bg-zinc-800 rounded-full opacity-50"></div>
                    )}
                  </div>
                  <span className="text-xs font-black text-zinc-500 group-hover:text-blue-500 transition-colors uppercase">Turno {s}</span>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex items-center justify-around text-[10px] font-bold text-zinc-500 border-t border-white/5 pt-4">
            <div className="flex flex-col items-center gap-1">
              <span className="uppercase text-[9px] opacity-70">Total Peças</span>
              <span className="text-white text-sm">
                {entries
                  .filter(e => e.date >= reportStartDate && e.date <= reportEndDate && (reportShift === 'Todos' || e.shift === reportShift))
                  .reduce((acc, curr) => acc + curr.quantity, 0)
                  .toLocaleString()}
              </span>
            </div>
            <div className="w-px h-8 bg-white/5"></div>
            <div className="flex flex-col items-center gap-1">
              <span className="uppercase text-[9px] opacity-70">Registros</span>
              <span className="text-white text-sm">
                {entries.filter(e => e.date >= reportStartDate && e.date <= reportEndDate && (reportShift === 'Todos' || e.shift === reportShift)).length}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3 px-1">
        <div className="flex justify-between items-end">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(0,122,255,0.5)]"></div>
            <p className="text-sm font-medium text-zinc-500">Pronto para exportar</p>
          </div>
          <p className="text-xs font-bold text-blue-500">100%</p>
        </div>
        <div className="w-full bg-zinc-900 h-2 rounded-full overflow-hidden border border-white/5">
          <div className="bg-blue-500 h-full w-[100%] rounded-full shadow-[0_0_10px_rgba(0,122,255,0.3)]"></div>
        </div>
      </section>
    </main>

    <footer className="bg-black border-t border-white/10 p-4 pb-8 space-y-3">
      <button
        onClick={handleShareReport}
        disabled={isSharing}
        className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50"
      >
        {isSharing ? (
          <RefreshCcw size={22} className="animate-spin" />
        ) : (
          <Share2 size={22} />
        )}
        <span className="notranslate uppercase tracking-tight">Compartilhar Relatório</span>
      </button>
      <button
        onClick={handleExportExcel}
        className="w-full bg-zinc-900 border border-white/10 hover:bg-zinc-800 text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-3 transition-colors active:scale-[0.98]"
      >
        <TableIcon size={22} className="text-zinc-500" />
        <span className="notranslate uppercase tracking-tight">Baixar Excel (.xlsx)</span>
      </button>
    </footer>
  </div>
);

const ShareModal = ({
  isOpen, onClose, onShare
}: {
  isOpen: boolean;
  onClose: () => void;
  onShare: (method: 'whatsapp' | 'email' | 'system' | 'download') => void;
}) => (
  <AnimatePresence>
    {isOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-blue-400 to-blue-600"></div>

          <div className="flex justify-between items-start mb-6">
            <div className="size-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Share2 size={24} />
            </div>
            <button onClick={onClose} className="p-2 -mr-2 text-zinc-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <h2 className="text-xl font-bold text-white mb-2">Compartilhar Relatório</h2>
          <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
            Escolha como deseja enviar o arquivo Excel do relatório de produção.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onShare('whatsapp')}
              className="flex flex-col items-center justify-center gap-3 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-2xl transition-all active:scale-95 group"
            >
              <div className="size-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-500 group-hover:scale-110 transition-transform">
                <MessageCircle size={22} />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-tight">WhatsApp</span>
            </button>

            <button
              onClick={() => onShare('email')}
              className="flex flex-col items-center justify-center gap-3 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-2xl transition-all active:scale-95 group"
            >
              <div className="size-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                <Mail size={22} />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-tight">E-mail</span>
            </button>

            <button
              onClick={() => onShare('system')}
              className="flex flex-col items-center justify-center gap-3 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-2xl transition-all active:scale-95 group"
            >
              <div className="size-10 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform">
                <Smartphone size={22} />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-tight">Bluetooth / Mais</span>
            </button>

            <button
              onClick={() => onShare('download')}
              className="flex flex-col items-center justify-center gap-3 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-white/5 rounded-2xl transition-all active:scale-95 group"
            >
              <div className="size-10 rounded-xl bg-zinc-500/20 flex items-center justify-center text-zinc-400 group-hover:scale-110 transition-transform">
                <Download size={22} />
              </div>
              <span className="text-xs font-bold text-white uppercase tracking-tight">Baixar Excel</span>
            </button>
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);
