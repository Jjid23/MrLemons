import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Users, Shield, ShieldCheck, Trash2, Mail } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  roleId: string;
  createdAt: string;
}

interface Role {
  id: string;
  name: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubRoles = onSnapshot(collection(db, 'roles'), (snapshot) => {
      setRoles(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    });

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return () => {
      unsubscribe();
      unsubRoles();
    };
  }, []);

  const changeRole = async (user: UserProfile, newRoleId: string) => {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        roleId: newRoleId
      });
      toast.success(`Updated ${user.name}'s status`);
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const deleteUser = async (user: UserProfile) => {
    if (!confirm(`Are you sure you want to delete ${user.name}? This will revoke their access.`)) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid));
      toast.success('User deleted');
    } catch (error) {
      toast.error('Failed to delete user');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-stone-400 font-bold uppercase tracking-widest text-xs">
      Loading workforce...
    </div>
  );

  return (
    <div className="bg-white dark:bg-stone-900 rounded-[48px] border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden transition-colors">
      <div className="p-10 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/30 dark:bg-stone-900/50">
        <h3 className="text-2xl font-black text-stone-800 dark:text-stone-100 flex items-center gap-4 italic uppercase tracking-tight">
          <div className="w-12 h-12 bg-lemon rounded-2xl flex items-center justify-center text-white shadow-xl shadow-lemon/20">
            <Users size={24} />
          </div>
          Staff Management
        </h3>
        <p className="text-stone-400 dark:text-stone-500 font-black uppercase tracking-[0.3em] text-[11px] italic">Managing {users.length} active staff</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-stone-50/50 dark:bg-stone-950 border-b border-stone-100 dark:border-stone-800">
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic">Identified Staff</th>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic">Access Status</th>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic">Communication</th>
              <th className="px-10 py-8 text-[11px] font-black uppercase tracking-[0.4em] text-stone-500 dark:text-stone-600 italic text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.uid} className="border-b border-stone-50 dark:border-stone-800 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition-all group">
                <td className="px-10 py-8">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-[28px] flex items-center justify-center border border-stone-200 dark:border-stone-700 overflow-hidden shadow-inner group-hover:scale-105 transition-transform">
                       <img 
                        src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} 
                        alt="avatar" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="font-black text-stone-800 dark:text-stone-100 text-xl tracking-tighter italic leading-none">{user.name}</p>
                      <p className="text-[10px] text-stone-400 dark:text-stone-500 font-black uppercase tracking-[0.3em] mt-3 italic">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-8">
                   <div className={cn(
                     "inline-flex items-center gap-3 px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-[0.3em] shadow-sm border",
                     user.roleId === 'admin' 
                      ? "bg-stone-800 dark:bg-lemon text-white dark:text-stone-900 border-stone-800 dark:border-lemon" 
                      : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-500 border-emerald-100 dark:border-emerald-900/30"
                   )}>
                     {user.roleId === 'admin' ? <ShieldCheck size={16} strokeWidth={2.5} /> : <Shield size={16} strokeWidth={2.5} />}
                     <span className="italic">{roles.find(r => r.id === user.roleId)?.name || user.roleId}</span>
                   </div>
                </td>
                <td className="px-10 py-8">
                   <div className="flex items-center gap-4 text-stone-500 dark:text-stone-600 font-black text-xs group-hover:text-stone-800 dark:group-hover:text-stone-100 transition-colors">
                     <div className="w-10 h-10 bg-stone-50 dark:bg-stone-800 rounded-xl flex items-center justify-center text-stone-300 dark:text-stone-700 shadow-inner">
                      <Mail size={18} />
                     </div>
                     <span className="italic">{user.email}</span>
                   </div>
                </td>
                <td className="px-10 py-8 text-right space-x-4">
                   <select 
                    value={user.roleId}
                    onChange={(e) => changeRole(user, e.target.value)}
                    className="bg-stone-50 dark:bg-stone-800 border-2 border-stone-100 dark:border-stone-700 rounded-2xl px-6 py-3 text-[11px] font-black uppercase tracking-[0.3em] focus:outline-none focus:border-lemon transition-all appearance-none cursor-pointer italic"
                   >
                     {roles.map(role => (
                       <option key={role.id} value={role.id}>{role.name}</option>
                     ))}
                   </select>
                   <button 
                    onClick={() => deleteUser(user)}
                    className="w-12 h-12 inline-flex items-center justify-center text-stone-300 dark:text-stone-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-[20px] transition-all active:scale-95 shadow-sm"
                    title="Delete User"
                   >
                     <Trash2 size={24} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
