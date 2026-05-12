import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { Shield, Plus, Trash2, CheckCircle2, Circle, Save, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface Role {
  id: string;
  name: string;
  permissions: string[];
  isSystem?: boolean;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'reports.view', name: 'View Analytics', desc: 'Access to dashboard charts and statistics' },
  { id: 'orders.read', name: 'View Orders', desc: 'View complete transaction history' },
  { id: 'orders.create', name: 'Process Orders', desc: 'Access to POS for selling items' },
  { id: 'inventory.manage', name: 'Manage Inventory', desc: 'Add/Edit/Delete stock items' },
  { id: 'users.manage', name: 'Manage Staff', desc: 'Create and oversee team members' },
  { id: 'roles.manage', name: 'Manage Roles', desc: 'Define permissions for the entire workforce' },
];

export function RoleManagement() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState<Partial<Role> | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'roles'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const rolesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Role);
      setRoles(rolesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'roles');
    });

    return () => unsubscribe();
  }, []);

  const handleSaveRole = async () => {
    if (!editingRole?.name) {
      toast.error('Role name is required');
      return;
    }

    const roleData = {
      name: editingRole.name,
      permissions: editingRole.permissions || [],
      updatedAt: new Date().toISOString(),
      isSystem: editingRole.isSystem || false
    };

    try {
      const roleRef = editingRole.id ? doc(db, 'roles', editingRole.id) : doc(collection(db, 'roles'));
      await setDoc(roleRef, roleData, { merge: true });
      toast.success(editingRole.id ? 'Role updated' : 'Role created');
      setEditingRole(null);
    } catch (error) {
      toast.error('Failed to save role');
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.isSystem) {
      toast.error('System roles cannot be deleted');
      return;
    }
    if (!confirm(`Permanently delete the "${role.name}" role? Users assigned to this role will lose permissions.`)) return;
    
    try {
      await deleteDoc(doc(db, 'roles', role.id));
      toast.success('Role deleted');
    } catch (error) {
      toast.error('Failed to delete role');
    }
  };

  const togglePermission = (permId: string) => {
    if (!editingRole) return;
    const currentSpecs = editingRole.permissions || [];
    const newSpecs = currentSpecs.includes(permId)
      ? currentSpecs.filter(p => p !== permId)
      : [...currentSpecs, permId];
    setEditingRole({ ...editingRole, permissions: newSpecs });
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-stone-400 font-black uppercase tracking-widest text-xs">
      Loading access settings...
    </div>
  );

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black text-stone-800 flex items-center gap-3">
            <div className="w-12 h-12 bg-lemon rounded-2xl flex items-center justify-center text-white shadow-lg shadow-lemon/20">
              <Shield size={28} />
            </div>
            Roles & Access
          </h2>
          <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px] mt-2 ml-1">
            Manage staff permissions and access levels
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Roles List */}
        <div className="bg-white rounded-[40px] border border-stone-200 shadow-xl shadow-stone-200/20 overflow-hidden">
          <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-stone-50/30">
            <h3 className="text-sm font-black uppercase tracking-widest text-stone-400">Available Roles</h3>
          </div>
          <div className="divide-y divide-stone-50">
            {roles.map((role) => (
              <div key={role.id} className="p-6 flex items-center justify-between group hover:bg-stone-50/50 transition-all cursor-default">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm",
                    role.isSystem ? "bg-amber-50 text-amber-600" : "bg-stone-100 text-stone-600"
                  )}>
                    <Shield size={24} />
                  </div>
                  <div>
                    <h4 className="font-black text-stone-800 text-lg flex items-center gap-2">
                       {role.name}
                       {role.isSystem && (
                         <span className="bg-stone-100 text-stone-400 text-[8px] px-2 py-0.5 rounded-full uppercase tracking-tighter">Default</span>
                       )}
                    </h4>
                    <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px]">
                      {role.permissions.length} Active Permissions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setEditingRole(role)}
                    className="bg-stone-800 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-stone-800/20 hover:bg-stone-900 active:scale-95 transition-all"
                  >
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editing Role */}
        <div className="min-h-[400px]">
          {editingRole ? (
            <div className="bg-white rounded-[40px] border border-stone-200 shadow-xl shadow-stone-200/20 overflow-hidden p-8 space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-stone-800 tracking-tight">
                    {editingRole.id ? `Edit ${editingRole.name}` : 'Create Role'}
                  </h3>
                  <p className="text-stone-400 font-bold uppercase tracking-widest text-[10px] mt-1">Manage permissions for this role</p>
                </div>
                <button 
                  onClick={() => setEditingRole(null)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-600 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Role Name</label>
                <div className="bg-stone-50 border-2 border-stone-100 rounded-[24px] px-6 py-4 font-black text-stone-800 opacity-50 cursor-not-allowed text-sm">
                  {editingRole.name}
                </div>
                <p className="text-[10px] text-stone-400 font-medium italic ml-2">Role name cannot be changed.</p>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 ml-2">Permissions</label>
                <div className="grid grid-cols-1 gap-3">
                  {AVAILABLE_PERMISSIONS.map((perm) => (
                    <button
                      key={perm.id}
                      onClick={() => togglePermission(perm.id)}
                      className={cn(
                        "flex items-start gap-4 p-5 rounded-[28px] border-2 transition-all text-left group",
                        editingRole.permissions?.includes(perm.id) 
                          ? "bg-olive/5 border-olive text-olive" 
                          : "bg-white border-stone-100 hover:border-stone-200"
                      )}
                    >
                      <div className={cn(
                        "mt-1 rounded-full",
                        editingRole.permissions?.includes(perm.id) ? "text-olive" : "text-stone-300"
                      )}>
                        {editingRole.permissions?.includes(perm.id) ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                      </div>
                      <div>
                        <p className={cn(
                          "font-black text-sm transition-colors",
                          editingRole.permissions?.includes(perm.id) ? "text-stone-800" : "text-stone-800"
                        )}>
                          {perm.name}
                        </p>
                        <p className="text-[11px] text-stone-400 font-bold leading-relaxed mt-0.5">{perm.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  onClick={handleSaveRole}
                  className="flex-1 bg-olive hover:bg-emerald-900 text-white font-black uppercase tracking-widest text-xs py-5 rounded-[28px] shadow-2xl shadow-olive/20 transition-all flex items-center justify-center gap-2 group active:scale-95"
                >
                  <Save size={18} className="group-hover:-translate-y-0.5 transition-transform" />
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center p-12 bg-stone-50/30 rounded-[40px] border-2 border-dashed border-stone-200 text-center space-y-6">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-stone-200 shadow-inner">
                <Shield size={40} strokeWidth={1.5} />
              </div>
              <div className="space-y-2">
                <h3 className="font-black text-stone-400 uppercase tracking-widest text-[10px]">No Role Selected</h3>
                <p className="text-stone-400 text-sm max-w-[280px] mx-auto leading-relaxed">
                  Select a role from the list to view or edit its permissions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
