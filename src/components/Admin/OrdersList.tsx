import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { Search, FileText, Download, ReceiptText, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export function OrdersList() {
  const [orders, setOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

  const filteredOrders = orders.filter(order => 
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.cashierName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportToCSV = () => {
    if (orders.length === 0) return;

    // Define CSV headers
    const headers = ['Order ID', 'Date', 'Cashier', 'Payment Method', 'Subtotal', 'VAT', 'Total', 'Items'];
    
    // Map orders to CSV rows
    const rows = orders.map(order => [
      `#${order.id}`,
      order.createdAt ? format(order.createdAt.toDate(), 'yyyy-MM-dd HH:mm:ss') : 'N/A',
      `"${order.cashierName}"`,
      order.paymentMethod,
      order.subtotal,
      order.vat,
      order.total,
      `"${order.items?.map((item: any) => `${item.quantity}x ${item.drinkName} (${item.size})${item.addOns?.length ? ` + ${item.addOns.join(', ')}` : ''}`).join('; ')}"`
    ]);

    // Join rows with commas and newlines
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mr-lemon-sales-history-${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="relative flex-1 max-w-lg group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-300 dark:text-stone-700 group-focus-within:text-lemon transition-colors" size={24} />
          <input 
            placeholder="Search transactions..." 
            className="w-full bg-white dark:bg-stone-900 border-2 border-stone-100 dark:border-stone-800 rounded-[32px] pl-16 pr-8 py-5 font-black text-stone-800 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-700 outline-none focus:border-lemon transition-all shadow-sm text-lg italic"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <button 
          onClick={exportToCSV}
          disabled={orders.length === 0}
          className="flex items-center gap-4 bg-stone-800 dark:bg-lemon text-white dark:text-stone-900 px-10 py-5 rounded-[32px] font-black text-sm uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all disabled:opacity-50 italic"
        >
          <Download size={22} />
          EXPORT SALES (CSV)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Table List */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-[48px] border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-50/50 dark:bg-stone-950 border-b border-stone-100 dark:border-stone-800">
                  <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic">Order Trace</th>
                  <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic text-center">Timestamp</th>
                  <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic text-center">Revenue</th>
                  <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic text-right">View</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => (
                  <tr 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)}
                    className={cn(
                      "border-b border-stone-50 dark:border-stone-800 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-all cursor-pointer group",
                      selectedOrder?.id === order.id && "bg-lemon/5 dark:bg-lemon/10 hover:bg-lemon/10 dark:hover:bg-lemon/20"
                    )}
                  >
                    <td className="px-10 py-8">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-natural dark:bg-stone-950 rounded-2xl flex items-center justify-center text-stone-400 dark:text-stone-600 border border-stone-100 dark:border-stone-800 group-hover:scale-105 transition-transform shadow-inner">
                          <ReceiptText size={28} />
                        </div>
                        <div>
                          <p className="font-black text-stone-900 dark:text-stone-100 text-xl tracking-tighter italic leading-none">#...{order.id.slice(-6).toUpperCase()}</p>
                          <p className="text-[10px] font-black text-stone-400 dark:text-stone-600 uppercase tracking-[0.3em] mt-3">{order.paymentMethod}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-[11px] font-black text-stone-600 dark:text-stone-500 uppercase tracking-widest text-center">
                      {order.createdAt ? format(order.createdAt.toDate(), 'MMM dd, hh:mm a') : '...'}
                    </td>
                    <td className="px-10 py-8 text-center">
                      <span className="font-black text-stone-900 dark:text-stone-100 text-xl italic tracking-tighter">₱{order.total.toLocaleString()}</span>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <div className={cn(
                         "w-12 h-12 rounded-full flex items-center justify-center ml-auto transition-all transform group-hover:bg-lemon/20",
                         selectedOrder?.id === order.id ? "bg-lemon text-white dark:text-stone-900" : "bg-transparent text-stone-200 dark:text-stone-800"
                       )}>
                        <ChevronRight size={24} className={cn(
                          "transition-all",
                          selectedOrder?.id === order.id && "translate-x-0.5"
                        )} />
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Side Detail */}
        <div className="bg-white dark:bg-stone-900 rounded-[48px] border border-stone-200 dark:border-stone-800 shadow-2xl p-10 h-fit lg:sticky lg:top-8 min-h-[600px] transition-colors">
          <AnimatePresence mode="wait">
            {selectedOrder ? (
              <motion.div 
                key={selectedOrder.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-10"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-3xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic uppercase leading-none">Receipt Detail</h4>
                    <p className="text-stone-400 dark:text-stone-500 font-bold uppercase tracking-[0.3em] text-[10px] mt-4">Transaction Snapshot</p>
                  </div>
                  <div className="w-16 h-16 bg-stone-800 dark:bg-lemon rounded-[24px] flex items-center justify-center text-white dark:text-stone-900 shadow-xl shadow-stone-200 dark:shadow-lemon/20 transition-colors">
                    <FileText size={32} />
                  </div>
                </div>

                <div className="bg-stone-50/50 dark:bg-stone-950 p-8 rounded-[40px] space-y-6 border-2 border-stone-100 dark:border-stone-800 shadow-inner transition-colors">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-stone-400 dark:text-stone-600 uppercase tracking-[0.4em] italic leading-none">ORDER ID</span>
                    <span className="text-xs font-black text-stone-800 dark:text-stone-100 truncate max-w-[150px] leading-none">#{selectedOrder.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-black text-stone-400 dark:text-stone-600 uppercase tracking-[0.4em] italic leading-none">LOGGED BY</span>
                    <span className="text-xs font-black text-stone-800 dark:text-stone-100 leading-none">{selectedOrder.cashierName}</span>
                  </div>
                </div>

                <div className="space-y-8 max-h-[400px] overflow-y-auto px-1 custom-scrollbar">
                  <p className="text-[11px] font-black text-stone-300 dark:text-stone-700 uppercase tracking-[0.5em] border-b border-stone-100 dark:border-stone-800 pb-4 italic">ORDER COMPOSITION</p>
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between group">
                      <div className="space-y-2">
                        <p className="text-lg font-black text-stone-800 dark:text-stone-100 italic leading-none">{item.quantity}x {item.drinkName}</p>
                        <p className="text-[11px] font-black text-stone-400 dark:text-stone-600 uppercase tracking-[0.2em] italic">
                          {item.size} • {item.flavor || item.category}
                          {item.addOns?.length > 0 && ` • + ${item.addOns.map((a: any) => typeof a === 'object' ? a.name : a).join(', ')}`}
                        </p>
                      </div>
                      <p className="text-lg font-black text-stone-800 dark:text-stone-100 italic leading-none">₱{item.price * item.quantity}</p>
                    </div>
                  ))}
                </div>

                <div className="pt-10 border-t-2 border-dashed border-stone-100 dark:border-stone-800 space-y-4">
                   <div className="flex justify-between text-xs font-black text-stone-400 dark:text-stone-600 uppercase tracking-[0.4em] italic leading-none">
                     <span>Subtotal</span>
                     <span>₱{selectedOrder.subtotal.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-xs font-black text-stone-400 dark:text-stone-600 uppercase tracking-[0.4em] italic leading-none">
                     <span>VAT (12%)</span>
                     <span>₱{selectedOrder.vat.toFixed(2)}</span>
                   </div>
                   <div className="flex justify-between text-4xl font-black text-stone-800 dark:text-stone-100 pt-8 italic">
                     <span className="tracking-tighter">TOTAL</span>
                     <span className="text-olive dark:text-lemon leading-none">₱{selectedOrder.total.toFixed(2)}</span>
                   </div>
                </div>

                <button className="w-full py-6 bg-stone-100 dark:bg-stone-800 rounded-[32px] text-stone-400 dark:text-stone-500 font-black text-[11px] uppercase tracking-[0.5em] hover:bg-stone-200 dark:hover:bg-stone-700 transition-all flex items-center justify-center gap-3 mt-6 italic">
                  <Download size={18} /> GENERATE PDF
                </button>
              </motion.div>
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center text-stone-300 dark:text-stone-800 space-y-8 opacity-60">
                <div className="w-32 h-32 border-4 border-dashed border-stone-100 dark:border-stone-800 rounded-[56px] flex items-center justify-center animate-pulse">
                  <FileText size={64} strokeWidth={1.5} />
                </div>
                <div className="text-center">
                  <p className="font-black text-[12px] uppercase tracking-[0.5em] italic">NO SELECTION</p>
                  <p className="text-stone-300 dark:text-stone-700 text-sm mt-4 max-w-[250px] mx-auto font-medium leading-relaxed italic">Select an order from the master list to view its audit trail and details.</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
