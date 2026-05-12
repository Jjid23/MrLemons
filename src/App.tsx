/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { Toaster } from 'sonner';
import { Login } from './components/Auth/Login';
import { POS } from './components/POS/POS';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { Layout } from './components/Layout';
import { Loader2, Shield } from 'lucide-react';

const INITIAL_INVENTORY = [
  { name: 'Cups 12oz', quantity: 500, unit: 'pcs' },
  { name: 'Cups 16oz', quantity: 500, unit: 'pcs' },
  { name: 'Cups 22oz', quantity: 500, unit: 'pcs' },
  { name: 'Lemon', quantity: 100, unit: 'pcs' },
  { name: 'Calamansi', quantity: 300, unit: 'pcs' },
  { name: 'Yakult', quantity: 50, unit: 'bottles' },
  { name: 'Nata de Coco', quantity: 20, unit: 'kg' },
  { name: 'Popping Boba', quantity: 20, unit: 'kg' },
  { name: 'Green Apple Syrup', quantity: 10, unit: 'liters' },
  { name: 'Strawberry Syrup', quantity: 10, unit: 'liters' },
  { name: 'Mango Syrup', quantity: 10, unit: 'liters' },
  { name: 'Kiwi Syrup', quantity: 10, unit: 'liters' },
  { name: 'Peach Syrup', quantity: 10, unit: 'liters' },
];

async function seedInventory() {
  const invPath = 'inventory';
  const invRef = collection(db, invPath);
  try {
    const snap = await getDocs(invRef);
    if (snap.empty) {
      for (const item of INITIAL_INVENTORY) {
        const itemDocRef = doc(invRef);
        await setDoc(itemDocRef, { ...item, updatedAt: new Date().toISOString() });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, invPath);
  }
}

async function seedRoles() {
  const rolesRef = collection(db, 'roles');
  try {
    const snap = await getDocs(rolesRef);
    if (snap.empty) {
      // Admin Role
      await setDoc(doc(db, 'roles', 'admin'), {
        name: 'Administrator',
        permissions: ['reports.view', 'orders.read', 'orders.create', 'inventory.manage', 'users.manage', 'roles.manage'],
        isSystem: true,
        updatedAt: new Date().toISOString()
      });
      // Staff Role
      await setDoc(doc(db, 'roles', 'staff'), {
        name: 'Staff',
        permissions: ['orders.create', 'orders.read'],
        isSystem: true,
        updatedAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error("Failed to seed roles:", error);
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'pos' | 'admin'>('pos');
  const theme = 'dark';

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.add('dark');
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setUser(user);
          const userPath = `users/${user.uid}`;
          const userRef = doc(db, 'users', user.uid);
          let userSnap;
          try {
            userSnap = await getDoc(userRef);
          } catch (error) {
            handleFirestoreError(error, OperationType.GET, userPath);
            return;
          }
          
          const ADMIN_EMAILS = ['jobertyeah23@gmail.com', 'earlperez@gmail.com'];
          const isSuperAdmin = user.email && ADMIN_EMAILS.includes(user.email);
          
          let currentUserData: any = null;
          if (userSnap.exists()) {
            currentUserData = userSnap.data();
            // Sync name if it was defaulted during race condition at signup
            if (currentUserData.name === 'Staff' && user.displayName && user.displayName !== 'Staff') {
              try {
                await setDoc(userRef, { name: user.displayName }, { merge: true });
                currentUserData.name = user.displayName;
              } catch (e) {
                console.error("Failed to sync displayName:", e);
              }
            }
            // Auto-promote super admins if they somehow have a staff role
            if (isSuperAdmin && currentUserData.roleId !== 'admin') {
              try {
                await setDoc(userRef, { roleId: 'admin' }, { merge: true });
                currentUserData.roleId = 'admin';
              } catch (e) {
                console.error("Failed to promote super admin:", e);
              }
            }
          } else {
            // New user bootstrap
            currentUserData = {
              uid: user.uid,
              email: user.email,
              name: user.displayName || 'Staff',
              roleId: isSuperAdmin ? 'admin' : 'staff',
              createdAt: new Date().toISOString()
            };
            try {
              await setDoc(userRef, currentUserData);
            } catch (error) {
              handleFirestoreError(error, OperationType.WRITE, userPath);
              return;
            }
          }
          
          setUserData(currentUserData);
          
          // Seed Roles and fetch permissions
          await seedRoles();
          
          if (currentUserData.roleId) {
            const roleSnap = await getDoc(doc(db, 'roles', currentUserData.roleId));
            if (roleSnap.exists()) {
              setPermissions(roleSnap.data().permissions || []);
            }
          }

          // Seed inventory if needed
          if (currentUserData.roleId === 'admin' || (user.email && ADMIN_EMAILS.includes(user.email))) {
            await seedInventory();
          }
        } else {
          setUser(null);
          setUserData(null);
          setPermissions([]);
        }
      } catch (error) {
        console.error("Auth state change error:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading || (user && !userData)) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
        <Loader2 className="w-10 h-10 animate-spin text-lime-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <Layout 
      user={userData} 
      permissions={permissions}
      view={view} 
      setView={setView}
    >
      {view === 'admin' && permissions.includes('reports.view') ? (
        <AdminDashboard permissions={permissions} />
      ) : permissions.includes('orders.create') ? (
        <POS user={userData} />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-stone-400 font-bold space-y-4">
          <Shield size={64} className="text-stone-200" />
          <div>
            <p className="text-stone-800 text-lg font-black uppercase tracking-widest">Access Suspended</p>
            <p className="text-sm">Your profile has no active permissions. Contact an admin.</p>
          </div>
        </div>
      )}
      <Toaster position="top-right" richColors />
    </Layout>
  );
}
