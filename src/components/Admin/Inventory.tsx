import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc } from 'firebase/firestore';
import { Package, Plus, Search, Trash2, Edit3, Save, X, AlertCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

export function Inventory() {
  const [items, setItems] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', quantity: 0, unit: 'pcs' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      setItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'inventory'), {
        ...newItem,
        updatedAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewItem({ name: '', quantity: 0, unit: 'pcs' });
      toast.success('Item added to inventory');
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  const handleUpdate = async (id: string, updates: any) => {
    try {
      await updateDoc(doc(db, 'inventory', id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      setEditingId(null);
      toast.success('Inventory updated');
    } catch (error) {
      toast.error('Update failed');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this item?')) return;
    try {
      await deleteDoc(doc(db, 'inventory', id));
      toast.success('Item removed');
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-[48px] border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden transition-colors">
      <div className="p-10 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/30 dark:bg-stone-900/50">
        <h3 className="text-2xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-4 italic uppercase tracking-tight">
          <div className="w-12 h-12 bg-lemon rounded-2xl flex items-center justify-center text-white shadow-xl shadow-lemon/20">
            <Package size={24} />
          </div>
          Inventory Management
        </h3>
        <button 
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-3 bg-stone-800 dark:bg-lemon text-white dark:text-stone-900 px-8 py-4 rounded-[28px] font-black text-xs uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all italic"
        >
          <Plus size={20} /> ADD NEW ITEM
        </button>
      </div>

      <div className="p-0">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-stone-50/50 dark:bg-stone-950 border-b border-stone-100 dark:border-stone-800">
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic">Item Name</th>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic">Current Stock</th>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isAdding && (
              <tr className="border-b border-lemon/20 bg-lemon/5 animate-in fade-in slide-in-from-top-4">
                <td className="px-10 py-8">
                   <input 
                     placeholder="Item name..." 
                     className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-[32px] px-8 py-5 text-lg w-full outline-lemon font-black text-stone-800 dark:text-stone-100 transition-all focus:border-lemon italic"
                     value={newItem.name}
                     onChange={e => setNewItem({...newItem, name: e.target.value})}
                   />
                </td>
                <td className="px-10 py-8">
                  <div className="flex items-center gap-6">
                    <input 
                      type="number"
                      placeholder="Qty"
                      className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-[32px] px-8 py-5 text-lg w-32 outline-lemon font-black text-stone-800 dark:text-stone-100 transition-all focus:border-lemon italic"
                      value={newItem.quantity}
                      onChange={e => setNewItem({...newItem, quantity: parseInt(e.target.value) || 0})}
                    />
                    <span className="text-[11px] font-black uppercase tracking-[0.3em] text-stone-500 dark:text-stone-600">{newItem.unit}</span>
                  </div>
                </td>
                <td className="px-10 py-8 text-right">
                   <div className="flex items-center justify-end gap-3">
                    <button onClick={handleAdd} className="w-14 h-14 bg-olive dark:bg-lemon text-white dark:text-stone-900 rounded-3xl flex items-center justify-center hover:bg-emerald-800 dark:hover:bg-zest shadow-xl shadow-olive/10 active:scale-90 transition-all"><Save size={24}/></button>
                    <button onClick={() => setIsAdding(false)} className="w-14 h-14 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 text-stone-400 rounded-3xl flex items-center justify-center hover:bg-stone-50 dark:hover:bg-stone-700 active:scale-90 transition-all"><X size={24}/></button>
                   </div>
                </td>
              </tr>
            )}
            {items.map(item => (
              <tr key={item.id} className="border-b border-stone-50 dark:border-stone-800 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-all group">
                {editingId === item.id ? (
                  <>
                    <td className="px-10 py-8">
                      <input 
                        className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-[32px] px-8 py-5 text-lg w-full outline-lemon font-black text-stone-800 dark:text-stone-100 transition-all focus:border-lemon italic"
                        value={editingItem.name}
                        onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                      />
                    </td>
                    <td className="px-10 py-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col gap-1 flex-1">
                            <label className="text-[9px] font-black uppercase text-stone-400">Current Qty</label>
                            <input 
                              type="number"
                              className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-[24px] px-6 py-4 text-base w-full outline-lemon font-black text-stone-800 dark:text-stone-100 transition-all focus:border-lemon italic"
                              value={editingItem.quantity}
                              onChange={e => setEditingItem({...editingItem, quantity: parseInt(e.target.value) || 0})}
                            />
                          </div>
                          <div className="flex flex-col gap-1 w-32">
                            <label className="text-[9px] font-black uppercase text-stone-400">Low Limit</label>
                            <input 
                              type="number"
                              className="bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-[24px] px-6 py-4 text-base w-full outline-lemon font-black text-stone-800 dark:text-stone-100 transition-all focus:border-lemon italic"
                              value={editingItem.lowStockThreshold || 10}
                              onChange={e => setEditingItem({...editingItem, lowStockThreshold: parseInt(e.target.value) || 0})}
                            />
                          </div>
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-stone-500 dark:text-stone-600 block pl-2">{item.unit}</span>
                      </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => handleUpdate(item.id, editingItem)} className="w-14 h-14 bg-olive dark:bg-lemon text-white dark:text-stone-900 rounded-3xl flex items-center justify-center hover:bg-emerald-800 dark:hover:bg-zest shadow-xl shadow-olive/10 active:scale-90 transition-all"><Save size={24}/></button>
                        <button onClick={() => setEditingId(null)} className="w-14 h-14 bg-white dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 text-stone-400 rounded-3xl flex items-center justify-center hover:bg-stone-50 dark:hover:bg-stone-700 active:scale-90 transition-all"><X size={24}/></button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-10 py-8 font-black text-stone-800 dark:text-stone-100 text-lg italic">{item.name}</td>
                    <td className="px-10 py-8">
                       <div className="flex items-center gap-4">
                          <span className={cn(
                            "font-black text-3xl tracking-tighter italic transition-colors",
                            item.quantity === 0 ? "text-red-500" : 
                            item.quantity <= (item.lowStockThreshold || 10) ? "text-orange-500" : 
                            "text-stone-800 dark:text-stone-100"
                          )}>
                            {item.quantity}
                          </span>
                          <span className="text-[11px] font-black uppercase tracking-[0.3em] text-stone-400 dark:text-stone-600">{item.unit}</span>
                          
                          {item.quantity === 0 ? (
                            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 dark:border-red-900/50">
                              <AlertCircle size={14} /> Out of Stock
                            </div>
                          ) : item.quantity <= (item.lowStockThreshold || 10) && (
                            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-orange-100 dark:border-orange-900/50">
                              <AlertTriangle size={14} /> Low Stock
                            </div>
                          )}
                       </div>
                    </td>
                    <td className="px-10 py-8 text-right">
                       <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                          <button 
                            onClick={() => {
                              setEditingId(item.id);
                              setEditingItem(item);
                            }} 
                            className="w-14 h-14 flex items-center justify-center text-stone-300 dark:text-stone-700 hover:text-lemon hover:bg-lemon/5 rounded-[20px] transition-all"
                          >
                            <Edit3 size={24} />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="w-14 h-14 flex items-center justify-center text-stone-300 dark:text-stone-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[20px] transition-all">
                            <Trash2 size={24} />
                          </button>
                       </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
