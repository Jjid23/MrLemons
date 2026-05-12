import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MENU, ADDONS } from '../../constants/menu';
import { ShoppingCart, Trash2, Plus, Minus, MoveRight, ChevronLeft, CreditCard, Banknote, ReceiptText, Search, Printer, Mail, Download, CheckCircle2, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import QRCode from 'qrcode';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  doc, 
  runTransaction, 
  getDocs, 
  query, 
  where,
  onSnapshot
} from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CartItem {
  cartId: string;
  drinkId: string;
  drinkName: string;
  size: string;
  category: string;
  flavor: string;
  addOns: { name: string; price: number }[];
  price: number;
  quantity: number;
}

export function POS({ user }: { user: any }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [step, setStep] = useState(1);
  
  const [selectedDrink, setSelectedDrink] = useState<any>(null);
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');
  const [selectedAddOns, setSelectedAddOns] = useState<{ name: string; price: number }[]>([]);
  const [selectedExtra, setSelectedExtra] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsubscribe;
  }, []);

  const getStock = (name: string) => {
    return inventory.find(i => i.name === name)?.quantity || 0;
  };

  const isDrinkSizeOutOfStock = (drink: any, size: string) => {
    if (!drink || !size) return false;
    const sizeData = drink.sizes[size];
    if (!sizeData?.inventory) return false;

    // Check base ingredients
    return Object.entries(sizeData.inventory).some(([name, qty]) => {
      return getStock(name) < (qty as number);
    });
  };

  const isFlavorOutOfStock = (drink: any, size: string, flavorName: string, category: string) => {
    if (!drink || !size) return false;
    
    // Check if the size itself is out of stock (base ingredients like Cups, Lemon, etc.)
    if (isDrinkSizeOutOfStock(drink, size)) return true;

    // Check specific flavor items (Yakult)
    if (flavorName.toLowerCase().includes('yakult')) {
      return getStock('Yakult') < 1;
    }

    // Check Syrups
    const syrupCategories = ['Flavored Selection', 'Cold Selection', 'Hot Selection', 'Flavor', 'Flavored Jam'];
    if (syrupCategories.includes(category)) {
        const baseFlavor = flavorName.replace(' Lemonade', '').replace(' Calamansi', '');
        const syrupName = `${baseFlavor} Syrup`;
        if (inventory.some(i => i.name === syrupName)) {
            return getStock(syrupName) < 1;
        }
    }

    return false;
  };

  const isAddOnOutOfStock = (addonName: string) => {
    const inventoryItem = inventory.find(i => i.name === addonName);
    // Only consider out of stock if the item exists in inventory and quantity is 0
    // If item doesn't exist in inventory, assume it's available
    return inventoryItem && inventoryItem.quantity < 1;
  };
  
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'gcash'>('cash');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [orderId, setOrderId] = useState<string>('');

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const vat = subtotal * 0.12;
  const total = subtotal + vat;

  const resetSelection = () => {
    setStep(1);
    setSelectedDrink(null);
    setSelectedSize('');
    setSelectedCategory('');
    setSelectedFlavor('');
    setSelectedExtra(0);
    setSelectedAddOns([]);
  };

  const addToCart = () => {
    const basePrice = selectedDrink.sizes[selectedSize].price;
    const addOnsPrice = selectedAddOns.reduce((sum, a) => sum + a.price, 0);
    const itemPrice = basePrice + selectedExtra + addOnsPrice;

    const newItem: CartItem = {
      cartId: Math.random().toString(36).substr(2, 9),
      drinkId: selectedDrink.id,
      drinkName: selectedDrink.name,
      size: selectedSize,
      category: selectedCategory,
      flavor: selectedFlavor,
      addOns: [...selectedAddOns],
      price: itemPrice,
      quantity: 1
    };

    setCart(prev => [...prev, newItem]);
    resetSelection();
    toast.success('Added to cart');
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.cartId !== id));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => 
      item.cartId === id ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item
    ));
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !user) return;
    setIsProcessing(true);
    
    const currentOrderData = {
      items: [...cart],
      subtotal,
      vat,
      total,
      paymentMethod,
      cashierId: user.uid,
      cashierName: user.name,
      createdAt: new Date()
    };

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Resolve Inventory IDs
        const inventoryRef = collection(db, 'inventory');
        let invSnapshot;
        try {
          invSnapshot = await getDocs(inventoryRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.LIST, 'inventory');
          return;
        }
        
        const invItems = invSnapshot.docs.map(d => ({ id: d.id, name: d.data().name, current: d.data().quantity }));

        const deductions: Record<string, number> = {};

        // Calculate deductions
        cart.forEach(item => {
          const drinkData = MENU.find(m => m.id === item.drinkId);
          const sizeData: any = drinkData?.sizes[item.size];
          
          // Base ingredients
          if (sizeData?.inventory) {
            Object.entries(sizeData.inventory).forEach(([name, qty]) => {
              deductions[name] = (deductions[name] || 0) + (qty as number * item.quantity);
            });
          }

          // Special ingredients (Yakult)
          if (item.flavor === 'Yakult') {
             deductions['Yakult'] = (deductions['Yakult'] || 0) + item.quantity;
          }

          // Flavor syrups
          const syrupCategories = ['Flavored Selection', 'Cold Selection', 'Hot Selection', 'Flavor', 'Flavored Jam'];
          if (syrupCategories.includes(item.category)) {
            const baseFlavor = item.flavor.replace(' Lemonade', '').replace(' Calamansi', '');
            const syrupName = `${baseFlavor} Syrup`;
            // Only deduct if the syrup exists in inventory
            if (invItems.some(i => i.name === syrupName)) {
               deductions[syrupName] = (deductions[syrupName] || 0) + item.quantity;
            }
          }

          // Add-ons
          item.addOns.forEach(addon => {
            deductions[addon.name] = (deductions[addon.name] || 0) + item.quantity;
          });
        });

        // 2. Perform Deductions
        for (const [name, qty] of Object.entries(deductions)) {
          const invItem = invItems.find(i => i.name === name);
          if (invItem) {
            const itemRef = doc(db, 'inventory', invItem.id);
            transaction.update(itemRef, {
              quantity: Math.max(0, invItem.current - qty),
              updatedAt: new Date().toISOString()
            });
          }
        }

        // 3. Save Order
        const ordersRef = collection(db, 'orders');
        const orderData = {
          ...currentOrderData,
          createdAt: serverTimestamp()
        };
        const newOrderRef = doc(ordersRef);
        transaction.set(newOrderRef, orderData);
        
        return { orderId: newOrderRef.id, deductions };
      }).then((result: any) => {
        const { orderId: id, deductions: completedDeductions } = result;
        setOrderId(id as string);
        setLastOrder(currentOrderData);
        setShowSuccess(true);
        toast.success('Order processed successfully!');
        
        // Check for low stock alerts after transaction
        const updatedInv = [...inventory];
        Object.entries(completedDeductions).forEach(([name, qty]) => {
          const item = updatedInv.find(i => i.name === name);
          if (item) {
            const newQty = Math.max(0, item.quantity - Number(qty));
            const threshold = item.lowStockThreshold || 10;
            if (newQty === 0) {
              toast.error(`${name} is now OUT OF STOCK!`, {
                description: 'Please replenish immediately.',
                duration: 5000
              });
            } else if (newQty <= threshold) {
              toast.warning(`${name} is running LOW (${newQty} left)`, {
                description: `Threshold is ${threshold}.`,
                duration: 4000
              });
            }
          }
        });

        setCart([]);
        setShowPayment(false);
      });

    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message.includes('{')) {
        toast.error('Security error. Check console.');
      } else {
        toast.error('Failed to process order');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const generateReceipt = async (id: string, order: any, action: 'download' | 'print' | 'email') => {
    const doc = new jsPDF({ unit: 'mm', format: [80, 250] }); // POS width
    
    // Header
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('MR LEMON POS', 40, 10, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('123 Zesty Street, Fruit City', 40, 15, { align: 'center' });
    doc.text('TIN: 000-123-456-789', 40, 19, { align: 'center' });
    
    doc.line(5, 23, 75, 23);
    
    doc.text(`Order ID: ${id}`, 5, 28);
    doc.text(`Cashier: ${order.cashierName}`, 5, 32);
    doc.text(`Date: ${order.createdAt.toLocaleString()}`, 5, 36);
    
    doc.line(5, 40, 75, 40);

    let y = 47;
    order.items.forEach((item: any) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${item.quantity}x ${item.drinkName} (${item.size})`, 5, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`${(item.price * item.quantity).toFixed(2)}`, 75, y, { align: 'right' });
      y += 4;
      doc.setFontSize(6);
      doc.text(`   ${item.flavor || item.category}`, 5, y);
      y += 3;
      if (item.addOns.length > 0) {
        doc.text(`   Add-ons: ${item.addOns.map((a: any) => a.name).join(', ')}`, 5, y);
        y += 3;
      }
      y += 2;
    });

    doc.line(5, y, 75, y);
    y += 5;
    doc.setFontSize(8);
    doc.text('Subtotal:', 5, y);
    doc.text(order.subtotal.toFixed(2), 75, y, { align: 'right' });
    y += 4;
    doc.text('VAT (12%):', 5, y);
    doc.text(order.vat.toFixed(2), 75, y, { align: 'right' });
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 5, y);
    doc.text(`PHP ${order.total.toFixed(2)}`, 75, y, { align: 'right' });
    y += 8;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Paid via: ${order.paymentMethod.toUpperCase()}`, 40, y, { align: 'center' });
    
    // QR Code
    try {
      const qrDataUrl = await QRCode.toDataURL(id);
      y += 5;
      doc.addImage(qrDataUrl, 'PNG', 25, y, 30, 30);
      y += 35;
    } catch (err) {
      console.error('QR Gen failed', err);
    }
    
    doc.text('Thank you for ordering!', 40, y, { align: 'center' });
    y += 4;
    doc.text('Visit us again!', 40, y, { align: 'center' });

    if (action === 'download') {
      doc.save(`receipt-${id}.pdf`);
    } else if (action === 'print') {
      window.open(doc.output('bloburl'), '_blank');
    } else if (action === 'email') {
      const email = prompt('Enter customer email:');
      if (email) {
        toast.info(`Emailing receipt to ${email}...`);
        // In a real app, you'd send the PDF to a server to email it.
        setTimeout(() => toast.success('Email sent successfully!'), 1500);
      }
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Selection Area */}
      <div className="flex-1 overflow-y-auto p-8 space-y-10 bg-natural dark:bg-stone-950 relative transition-colors">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h2 className="text-6xl font-black text-stone-800 dark:text-stone-100 tracking-tight leading-none italic">NEW ORDER</h2>
            <p className="text-stone-500 dark:text-stone-400 font-bold uppercase tracking-[0.2em] text-[10px] mt-4">Point of Sale Terminal</p>
          </div>
          
          <div className="flex items-center gap-4 bg-white dark:bg-stone-900 p-4 rounded-[28px] shadow-sm border border-stone-100 dark:border-stone-800 transition-colors">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center">
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black transition-all duration-500",
                  step === s ? "bg-lemon text-stone-800 scale-110 shadow-lg shadow-lemon/30" : 
                  step > s ? "bg-stone-800 dark:bg-stone-100 dark:text-stone-900 text-white" : "bg-stone-100 dark:bg-stone-800 text-stone-300 dark:text-stone-600"
                )}>
                  {s}
                </div>
                {s < 4 && <div className={cn("w-6 h-[2px] mx-1 rounded-full", step > s ? "bg-stone-800 dark:bg-stone-100" : "bg-stone-100 dark:bg-stone-800")} />}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-8"
            >
              {MENU.map(drink => (
                <button
                  key={drink.id}
                  onClick={() => { setSelectedDrink(drink); setStep(2); }}
                  className="group relative h-56 rounded-[40px] bg-white dark:bg-stone-900 border-2 border-stone-100 dark:border-stone-800 p-8 text-left transition-all hover:border-lemon hover:shadow-2xl hover:shadow-lemon/10 active:scale-95 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-lemon/5 rounded-bl-[100px] -mr-8 -mt-8 group-hover:bg-lemon/10 transition-colors"></div>
                  
                  <div className="flex items-center h-full relative z-10">
                    <div className="w-28 h-28 bg-stone-50 dark:bg-stone-800 rounded-[32px] flex items-center justify-center mr-8 group-hover:bg-natural dark:group-hover:bg-stone-950 group-hover:scale-110 transition-all duration-500 shadow-inner leading-none">
                       <span className="text-6xl group-hover:rotate-12 transition-transform">{drink.id === 'lemonade' ? '🍋' : '🍏'}</span>
                    </div>
                    <div>
                      <h3 className="text-4xl font-black text-stone-800 dark:text-stone-100 tracking-tight italic">{drink.name}</h3>
                      <p className="text-[10px] text-stone-500 dark:text-stone-400 uppercase tracking-[0.4em] font-black mt-3">PREMIUM EXTRACT</p>
                    </div>
                  </div>
                  
                  <div className="absolute bottom-8 right-8 w-12 h-12 bg-stone-800 text-white rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300">
                    <MoveRight size={24} />
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <button onClick={() => setStep(1)} className="flex items-center gap-3 text-stone-400 hover:text-stone-800 font-black text-[10px] uppercase tracking-widest transition-colors group">
                 <div className="w-8 h-8 rounded-full border-2 border-stone-100 flex items-center justify-center group-hover:border-stone-800 transition-colors">
                  <ChevronLeft size={16} /> 
                 </div>
                 Back to drinks
              </button>
              
              <div className="space-y-4">
                <h3 className="text-5xl font-black text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-6 italic">
                   <div className="w-16 h-16 bg-natural dark:bg-stone-800 rounded-3xl flex items-center justify-center shadow-inner border border-stone-100 dark:border-stone-700 text-stone-400">2</div>
                   SELECT SIZE
                </h3>
                <p className="text-stone-500 dark:text-stone-400 font-bold uppercase tracking-[0.3em] text-[10px] ml-22">Choose cup capacity</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {Object.keys(selectedDrink.sizes).map(size => {
                  const data = selectedDrink.sizes[size];
                  const outOfStock = isDrinkSizeOutOfStock(selectedDrink, size);
                  return (
                    <button
                      key={size}
                      disabled={outOfStock}
                      onClick={() => { setSelectedSize(size); setStep(3); }}
                      className={cn(
                        "group h-48 rounded-[48px] border-2 border-stone-100 dark:border-stone-800 bg-white dark:bg-stone-900 flex flex-col items-center justify-center transition-all hover:border-lemon hover:shadow-2xl hover:shadow-lemon/5 active:scale-95 disabled:opacity-40 disabled:grayscale disabled:hover:border-stone-100",
                        outOfStock && "cursor-not-allowed"
                      )}
                    >
                      <p className="text-4xl font-black text-stone-800 dark:text-stone-100 tracking-tighter group-hover:scale-110 transition-transform">{size}</p>
                      <p className="text-[11px] font-black text-stone-400 uppercase tracking-[0.4em] mt-4">{outOfStock ? 'OUT OF STOCK' : data.type}</p>
                      <div className="mt-6 px-6 py-2 bg-stone-50 dark:bg-stone-800 rounded-full text-[10px] font-black text-stone-400 dark:text-stone-500 group-hover:bg-lemon group-hover:text-stone-800 transition-colors">
                        BASE PHP {data.price}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-10"
            >
              <button onClick={() => setStep(2)} className="flex items-center gap-3 text-stone-400 hover:text-stone-800 font-black text-[10px] uppercase tracking-widest transition-colors group">
                 <div className="w-8 h-8 rounded-full border-2 border-stone-100 flex items-center justify-center group-hover:border-stone-800 transition-colors">
                  <ChevronLeft size={16} /> 
                 </div>
                 Back to capacity
              </button>

              <div className="space-y-4">
                <h3 className="text-5xl font-black text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-6 italic">
                  <div className="w-16 h-16 bg-natural dark:bg-stone-800 rounded-3xl flex items-center justify-center shadow-inner border border-stone-100 dark:border-stone-700 text-stone-400">3</div>
                  SELECT FLAVOR
                </h3>
                <p className="text-stone-500 dark:text-stone-400 font-bold uppercase tracking-[0.3em] text-[10px] ml-22">Infuse natural flavoring</p>
              </div>
              
              <div className="space-y-12">
                {selectedDrink?.sizes?.[selectedSize]?.categories && Object.entries(selectedDrink.sizes[selectedSize].categories).map(([cat, options]) => (
                  <div key={cat} className="space-y-8">
                    <div className="flex items-center gap-6">
                      <div className="h-[2px] flex-1 bg-stone-100 dark:bg-stone-800"></div>
                      <h4 className="text-[11px] uppercase tracking-[0.5em] font-black text-stone-400 dark:text-stone-500 italic">{cat}</h4>
                      <div className="h-[2px] flex-1 bg-stone-100 dark:bg-stone-800"></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {(options as any[]).map((opt: any) => {
                        const name = typeof opt === 'string' ? opt : opt.name;
                        const extra = typeof opt === 'object' ? opt.extra || 0 : 0;
                        const outOfStock = isFlavorOutOfStock(selectedDrink, selectedSize, name, cat);
                        return (
                          <button
                            key={name}
                            disabled={outOfStock}
                            onClick={() => {
                              setSelectedCategory(cat);
                              setSelectedFlavor(name);
                              setSelectedExtra(extra);
                              setStep(4);
                            }}
                            className={cn(
                              "p-8 rounded-[40px] border-2 transition-all active:scale-95 text-center group flex flex-col items-center justify-center gap-2 disabled:opacity-40 disabled:grayscale",
                              selectedFlavor === name 
                                ? "bg-stone-800 dark:bg-lemon border-stone-800 dark:border-lemon text-white dark:text-stone-900 shadow-2xl shadow-stone-800/20" 
                                : "bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 hover:border-lemon hover:bg-lemon/5"
                            )}
                          >
                            <p className="text-sm font-black uppercase tracking-widest leading-tight">{outOfStock ? 'NO STOCK' : name}</p>
                            {extra > 0 && !outOfStock && <span className="text-[10px] opacity-60 font-black">+₱{extra}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Fallback for flat flavor list if categories don't exist */}
                {!selectedDrink?.sizes?.[selectedSize]?.categories && selectedDrink?.sizes?.[selectedSize]?.flavors && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    {(selectedDrink.sizes[selectedSize].flavors as any[]).map((opt: any) => {
                      const name = typeof opt === 'string' ? opt : opt.name;
                      const extra = typeof opt === 'object' ? opt.extra || 0 : 0;
                      const outOfStock = isFlavorOutOfStock(selectedDrink, selectedSize, name, 'Standard');
                      return (
                        <button
                          key={name}
                          disabled={outOfStock}
                          onClick={() => {
                            setSelectedCategory('Standard');
                            setSelectedFlavor(name);
                            setSelectedExtra(extra);
                            setStep(4);
                          }}
                          className={cn(
                            "p-8 rounded-[40px] border-2 transition-all active:scale-95 text-center group flex flex-col items-center justify-center gap-2 disabled:opacity-40 disabled:grayscale",
                            selectedFlavor === name 
                              ? "bg-stone-800 dark:bg-lemon border-stone-800 dark:border-lemon text-white dark:text-stone-900 shadow-2xl shadow-stone-800/20" 
                              : "bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 text-stone-500 dark:text-stone-400 hover:border-lemon hover:bg-lemon/5"
                          )}
                        >
                          <p className="text-sm font-black uppercase tracking-widest leading-tight">{outOfStock ? 'NO STOCK' : name}</p>
                          {extra > 0 && !outOfStock && <span className="text-[10px] opacity-60 font-black">+₱{extra}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* If both are missing, provide a "Default" option to move forward */}
                {(!selectedDrink?.sizes?.[selectedSize]?.categories || Object.keys(selectedDrink.sizes[selectedSize].categories).length === 0) && !selectedDrink?.sizes?.[selectedSize]?.flavors && (
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setSelectedCategory('Base');
                        setSelectedFlavor('Classic');
                        setStep(4);
                      }}
                      className="p-10 px-16 rounded-[48px] bg-stone-800 dark:bg-lemon text-white dark:text-stone-900 font-black uppercase tracking-[0.5em] hover:bg-stone-900 transition-all shadow-2xl italic"
                    >
                      CONTINUE WITH CLASSIC
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div 
              key="step4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-10"
            >
              <button onClick={() => setStep(3)} className="flex items-center gap-3 text-stone-400 hover:text-stone-800 font-black text-[10px] uppercase tracking-widest transition-colors group">
                 <div className="w-8 h-8 rounded-full border-2 border-stone-100 flex items-center justify-center group-hover:border-stone-800 transition-colors">
                  <ChevronLeft size={16} /> 
                 </div>
                 Back to essence
              </button>

              <div className="space-y-4">
                <h3 className="text-5xl font-black text-stone-800 dark:text-stone-100 tracking-tight flex items-center gap-6 italic">
                  <div className="w-16 h-16 bg-natural dark:bg-stone-800 rounded-3xl flex items-center justify-center shadow-inner border border-stone-100 dark:border-stone-700 text-stone-400">4</div>
                  ADD-ONS
                </h3>
                <p className="text-stone-500 dark:text-stone-400 font-bold uppercase tracking-[0.3em] text-[10px] ml-22">Customize your drink</p>
              </div>
              
              <div className="flex flex-wrap gap-6">
                {ADDONS.map(addon => {
                  const isSelected = selectedAddOns.some(a => a.name === addon.name);
                  const outOfStock = isAddOnOutOfStock(addon.name);
                  return (
                    <button
                      key={addon.name}
                      disabled={outOfStock}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedAddOns(prev => prev.filter(a => a.name !== addon.name));
                        } else {
                          setSelectedAddOns(prev => [...prev, addon]);
                        }
                      }}
                      className={cn(
                        "px-10 py-6 rounded-[32px] border-2 transition-all active:scale-95 text-xs font-black uppercase tracking-widest flex items-center gap-4 shadow-sm disabled:opacity-40 disabled:grayscale",
                        isSelected 
                          ? "bg-lemon border-lemon text-stone-800 shadow-lemon/20" 
                          : "bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500 hover:bg-stone-50 dark:hover:bg-stone-800 hover:border-stone-200 dark:hover:border-stone-700"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-lg flex items-center justify-center transition-colors border",
                        isSelected ? "bg-stone-800 text-lemon border-stone-800" : "bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700"
                      )}>
                        {isSelected && <Plus size={14} strokeWidth={4} />}
                      </div>
                      {outOfStock ? `${addon.name} (OUT)` : addon.name}
                      {!outOfStock && <span className="ml-2 py-1.5 px-3 bg-black/5 dark:bg-white/5 rounded-lg text-[10px] opacity-60">PHP {addon.price}</span>}
                    </button>
                  )
                })}
              </div>

              <div className="pt-12 flex justify-end">
                <button
                  onClick={addToCart}
                  className="bg-stone-800 dark:bg-lemon text-white dark:text-stone-900 px-16 py-8 rounded-[40px] font-black text-lg uppercase tracking-[0.3em] shadow-2xl shadow-stone-800/30 dark:shadow-lemon/20 hover:bg-stone-900 dark:hover:bg-zest active:scale-95 transition-all group flex items-center gap-6"
                >
                  <Plus size={28} className="group-hover:rotate-90 transition-transform" />
                  ADD TO CART
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart Area - Technical Receipt Style */}
      <aside className="w-96 bg-white dark:bg-stone-900 border-l border-stone-200 dark:border-stone-800 flex flex-col shadow-2xl relative z-20">
        <div className="p-8 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between bg-stone-50/50 dark:bg-stone-800/30">
          <div>
            <h2 className="text-xs font-black text-stone-500 dkark:text-stone-400 uppercase tracking-[0.4em] italic mb-1">
              CURRENT ORDER
            </h2>
            <p className="text-base font-black text-stone-900 dark:text-stone-100">{cart.length} Items Selected</p>
          </div>
          <button 
            onClick={() => setCart([])}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 text-stone-300 hover:text-red-500 hover:border-red-100 transition-all active:scale-90"
            title="Clear Cart"
          >
            <Trash2 size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-200 dark:text-stone-700 space-y-6 opacity-60">
              <div className="w-24 h-24 bg-stone-50 dark:bg-stone-800 rounded-[40px] flex items-center justify-center shadow-inner">
                <ReceiptText size={48} strokeWidth={1} />
              </div>
              <div className="text-center space-y-3">
                <p className="font-black uppercase tracking-[0.4em] text-[10px] italic">CART IS EMPTY</p>
                <p className="text-xs font-bold text-stone-300 dark:text-stone-600 max-w-[200px]">Add some zest to start a session</p>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {cart.map((item) => (
                <motion.div 
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={item.cartId}
                  className="flex flex-col space-y-5 p-6 rounded-[32px] bg-stone-50/50 dark:bg-stone-800/30 border border-stone-100 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors group"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-black text-stone-800 dark:text-stone-100 text-base tracking-tight leading-none italic">{item.drinkName}</p>
                      <p className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-[0.2em] mt-3">{item.size} • {item.flavor || item.category}</p>
                    </div>
                    <p className="font-black text-stone-800 dark:text-stone-100 text-base">₱{(item.price * item.quantity).toFixed(2)}</p>
                  </div>

                  {item.addOns.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {item.addOns.map((a, i) => (
                        <span key={i} className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-white border border-stone-200 text-stone-400 rounded-md">
                          + {a.name}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-stone-100/50">
                     <div className="flex items-center bg-white rounded-xl border border-stone-100 p-1">
                        <button 
                          onClick={() => updateQuantity(item.cartId, -1)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-50 transition-colors"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="text-sm font-black text-stone-800">{item.quantity}</span>
                         <button 
                           onClick={() => updateQuantity(item.cartId, 1)}
                           className="w-8 h-8 rounded-lg flex items-center justify-center text-stone-400 hover:bg-stone-50 transition-colors"
                         >
                          <Plus size={14} />
                        </button>
                     </div>
                     <button 
                        onClick={() => removeFromCart(item.cartId)}
                        className="w-8 h-8 flex items-center justify-center text-stone-200 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="p-8 bg-stone-50 dark:bg-stone-800/30 border-t border-stone-200 dark:border-stone-800 space-y-6 relative overflow-hidden transition-colors">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-16 h-1 bg-stone-200 dark:bg-stone-700 rounded-full mt-2"></div>
          
          <div className="space-y-4 mt-4">
            <div className="flex justify-between text-[11px] text-stone-400 dark:text-stone-500 font-black uppercase tracking-widest leading-none">
              <span>Subtotal</span>
              <span>₱{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-stone-400 dark:text-stone-500 font-black uppercase tracking-widest leading-none">
              <span>VAT (12%)</span>
              <span>₱{vat.toFixed(2)}</span>
            </div>
          </div>

          <div className="flex justify-between items-end pt-6 border-t-2 border-dashed border-stone-200 dark:border-stone-800">
             <span className="text-[11px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-[0.4em] mb-1 italic">TOTAL AMOUNT</span>
             <span className="text-5xl font-black text-stone-800 dark:text-stone-100 tracking-tighter italic">₱{total.toFixed(2)}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <button 
               onClick={() => { setPaymentMethod('cash'); setShowPayment(true); }}
               className={cn(
                 "py-5 rounded-[28px] font-black text-xs uppercase tracking-widest transition-all border-2",
                 paymentMethod === 'cash' 
                  ? "bg-stone-800 dark:bg-lemon border-stone-800 dark:border-lemon text-white dark:text-stone-900" 
                  : "bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500 hover:border-stone-200 dark:hover:border-stone-700"
               )}
             >
               Cash
             </button>
             <button 
               onClick={() => { setPaymentMethod('gcash'); setShowPayment(true); }}
               className={cn(
                 "py-5 rounded-[28px] font-black text-xs uppercase tracking-widest transition-all border-2",
                 paymentMethod === 'gcash' 
                  ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "bg-white dark:bg-stone-900 border-stone-100 dark:border-stone-800 text-stone-400 dark:text-stone-500 hover:border-stone-200 dark:hover:border-stone-700"
               )}
             >
               GCash
             </button>
          </div>

          <motion.button 
            disabled={cart.length === 0}
            onClick={() => setShowPayment(true)}
            whileHover={{ scale: cart.length > 0 ? 1.02 : 1 }}
            whileTap={{ scale: cart.length > 0 ? 0.98 : 1 }}
            animate={cart.length > 0 ? {
              boxShadow: ["0px 20px 40px rgba(0, 0, 0, 0.4)", "0px 20px 60px rgba(0, 0, 0, 0.6)", "0px 20px 40px rgba(0, 0, 0, 0.4)"]
            } : {}}
            transition={{ 
              boxShadow: { repeat: Infinity, duration: 2, ease: "easeInOut" }
            }}
            className="w-full bg-olive dark:bg-lemon text-white dark:text-stone-900 font-black py-8 rounded-[40px] text-base uppercase tracking-[0.4em] shadow-2xl disabled:opacity-20 disabled:grayscale transition-all flex items-center justify-center gap-4 relative overflow-hidden group italic"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/0 via-white/10 to-emerald-600/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <span className="relative z-10">PROCESS CHECKOUT</span>
            <MoveRight size={28} className="relative z-10 group-hover:translate-x-2 transition-transform" />
          </motion.button>
        </div>
      </aside>

      {/* Payment Modal */}
      <AnimatePresence>
        {showPayment && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               onClick={() => !isProcessing && setShowPayment(false)}
               className="absolute inset-0 bg-zinc-900/60 backdrop-blur-md"
             />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 30 }}
                className="relative w-full max-w-xl bg-white dark:bg-stone-950 rounded-[56px] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] border border-stone-100 dark:border-stone-800 transition-colors"
              >
                <div className="p-12 space-y-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-5xl font-black text-stone-800 dark:text-stone-100 tracking-tighter italic uppercase leading-none">Payment</h3>
                      <p className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-[0.4em] mt-3">Finalize the session</p>
                    </div>
                    <button 
                      onClick={() => setShowPayment(false)} 
                      className="w-14 h-14 flex items-center justify-center rounded-3xl bg-stone-50 dark:bg-stone-900 text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-800 dark:hover:text-stone-100 transition-all shadow-inner"
                    >
                      <Plus className="rotate-45" size={28} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <button 
                      onClick={() => setPaymentMethod('cash')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-8 p-12 rounded-[48px] border-2 transition-all relative group shadow-sm",
                        paymentMethod === 'cash' 
                          ? "bg-natural dark:bg-stone-900 border-stone-800 dark:border-lemon text-stone-800 dark:text-lemon shadow-2xl dark:shadow-lemon/10" 
                          : "bg-white dark:bg-stone-950 border-stone-50 dark:border-stone-900 text-stone-200 dark:text-stone-800 opacity-40 hover:opacity-60"
                      )}
                    >
                      <div className={cn(
                        "w-24 h-24 rounded-[32px] flex items-center justify-center transition-all shadow-inner",
                        paymentMethod === 'cash' ? "bg-stone-800 dark:bg-lemon text-white dark:text-stone-900" : "bg-stone-50 dark:bg-stone-900"
                      )}>
                        <Banknote size={48} strokeWidth={1.5} />
                      </div>
                      <span className="font-black text-xs uppercase tracking-[0.3em] italic">Cash Payment</span>
                      {paymentMethod === 'cash' && <div className="absolute top-6 right-6 w-4 h-4 bg-stone-800 dark:bg-lemon rounded-full animate-ping"></div>}
                    </button>
                    
                    <button 
                      onClick={() => setPaymentMethod('gcash')}
                      className={cn(
                        "flex flex-col items-center justify-center gap-8 p-12 rounded-[48px] border-2 transition-all relative group shadow-sm",
                        paymentMethod === 'gcash' 
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-600 text-blue-600 shadow-2xl" 
                          : "bg-white dark:bg-stone-950 border-stone-50 dark:border-stone-900 text-stone-200 dark:text-stone-800 opacity-40 hover:opacity-60"
                      )}
                    >
                      <div className={cn(
                        "w-24 h-24 rounded-[32px] flex items-center justify-center transition-all shadow-inner",
                        paymentMethod === 'gcash' ? "bg-blue-600 text-white" : "bg-stone-50 dark:bg-stone-900"
                      )}>
                        <CreditCard size={48} strokeWidth={1.5} />
                      </div>
                      <span className="font-black text-xs uppercase tracking-[0.3em] italic">Digital GC</span>
                      {paymentMethod === 'gcash' && <div className="absolute top-6 right-6 w-4 h-4 bg-blue-600 rounded-full animate-ping"></div>}
                    </button>
                  </div>

                  <div className="bg-stone-50/80 dark:bg-stone-900/50 p-10 rounded-[48px] space-y-4 border-2 border-stone-100 dark:border-stone-800 shadow-inner transition-colors">
                    <p className="text-center text-[11px] font-black text-stone-300 dark:text-stone-600 uppercase tracking-[0.5em] italic leading-none">TOTAL RECEIVABLE</p>
                    <h4 className="text-center text-6xl font-black text-stone-800 dark:text-stone-100 tracking-tighter italic leading-none">₱{total.toFixed(2)}</h4>
                  </div>

                  <button
                    disabled={isProcessing}
                    onClick={handleCheckout}
                    className={cn(
                      "w-full py-9 rounded-[44px] font-black text-white dark:text-stone-900 text-base uppercase tracking-[0.4em] shadow-2xl transition-all active:scale-[0.97] group flex items-center justify-center gap-6 italic",
                      paymentMethod === 'cash' ? "bg-stone-800 dark:bg-lemon shadow-stone-800/20 dark:shadow-lemon/20" : "bg-blue-600 shadow-blue-600/20"
                    )}
                  >
                    {isProcessing ? 'PROCESSING...' : (
                      <>
                        <ReceiptText size={24} className="group-hover:rotate-12 transition-transform" />
                        Complete Session
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccess && lastOrder && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-stone-900/60 backdrop-blur-md"
              onClick={() => setShowSuccess(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-[56px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] overflow-hidden transition-colors"
            >
              <div className="bg-lemon p-12 text-center relative">
                <button 
                  onClick={() => setShowSuccess(false)}
                  className="absolute top-8 right-8 w-12 h-12 bg-white/20 hover:bg-white/40 rounded-full flex items-center justify-center transition-colors"
                >
                  <X size={24} />
                </button>
                <div className="w-28 h-28 bg-white rounded-[40px] flex items-center justify-center mx-auto mb-8 shadow-2xl text-emerald-500 transform -rotate-6 transition-transform hover:rotate-0">
                  <CheckCircle2 size={64} strokeWidth={2.5} />
                </div>
                <h3 className="text-5xl font-black text-stone-800 tracking-tight italic uppercase leading-none">SUCCESS!</h3>
                <p className="text-stone-800/60 font-black uppercase tracking-[0.3em] text-[11px] mt-4">Order #{orderId.slice(-6).toUpperCase()}</p>
              </div>

              <div className="p-12 space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-6 text-stone-400 dark:text-stone-600">
                    <div className="h-[1px] flex-1 bg-stone-100 dark:bg-stone-800"></div>
                    <span className="text-[11px] uppercase tracking-[0.5em] font-black italic">Receipt Trace</span>
                    <div className="h-[1px] flex-1 bg-stone-100 dark:bg-stone-800"></div>
                  </div>

                  <div className="space-y-4">
                    {lastOrder.items.map((item: any, i: number) => (
                      <div key={i} className="flex justify-between items-start text-lg">
                        <div className="flex-1">
                          <p className="font-black text-stone-800 dark:text-stone-100 italic leading-none">{item.quantity}x {item.drinkName}</p>
                          <p className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-[0.2em] mt-2 italic">
                            {item.size} • {item.flavor || item.category}
                          </p>
                        </div>
                        <span className="font-black text-stone-800 dark:text-stone-100">₱{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-8 border-t border-stone-100 dark:border-stone-800 flex justify-between items-end transition-colors">
                      <span className="text-[11px] font-black text-stone-400 dark:text-stone-600 uppercase tracking-[0.4em] mb-1 italic">Total Collected</span>
                      <span className="text-5xl font-black text-stone-800 dark:text-stone-100 tracking-tighter italic leading-none">₱{lastOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <button 
                    onClick={() => generateReceipt(orderId, lastOrder, 'print')}
                    className="flex flex-col items-center justify-center gap-4 p-8 bg-stone-50 dark:bg-stone-800 rounded-[40px] hover:bg-stone-100 dark:hover:bg-stone-700 transition-all group shadow-sm"
                  >
                    <div className="w-16 h-16 bg-white dark:bg-stone-900 rounded-[24px] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Printer size={28} className="text-stone-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Print</span>
                  </button>
                  <button 
                    onClick={() => generateReceipt(orderId, lastOrder, 'email')}
                    className="flex flex-col items-center justify-center gap-4 p-8 bg-stone-50 dark:bg-stone-800 rounded-[40px] hover:bg-stone-100 dark:hover:bg-stone-700 transition-all group shadow-sm"
                  >
                    <div className="w-16 h-16 bg-white dark:bg-stone-900 rounded-[24px] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Mail size={28} className="text-stone-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Email</span>
                  </button>
                  <button 
                    onClick={() => generateReceipt(orderId, lastOrder, 'download')}
                    className="flex flex-col items-center justify-center gap-4 p-8 bg-stone-50 dark:bg-stone-800 rounded-[40px] hover:bg-stone-100 dark:hover:bg-stone-700 transition-all group shadow-sm"
                  >
                    <div className="w-16 h-16 bg-white dark:bg-stone-900 rounded-[24px] flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                      <Download size={28} className="text-stone-400" />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">PDF</span>
                  </button>
                </div>

                <button 
                  onClick={() => setShowSuccess(false)}
                  className="w-full bg-stone-800 dark:bg-lemon text-white dark:text-stone-900 font-black py-8 rounded-[40px] text-sm uppercase tracking-[0.5em] shadow-2xl hover:bg-stone-900 dark:hover:bg-zest transition-all active:scale-95 italic transition-colors leading-none"
                >
                  START NEW ORDER
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const Citrus = ({ size, className }: { size: number; className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="1.5" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21.66 17.67a10.85 10.85 0 0 0-1.32-9c-.13-.19-.13-.42 0-.61l.93-1.36a1 1 0 0 0-.25-1.4 10.84 10.84 0 0 0-4.6-2.26 1 1 0 0 0-1.12.58l-.6 1.54c-.08.2-.25.33-.47.33a10.87 10.87 0 0 0-4.48 0c-.22 0-.39-.13-.47-.33l-.6-1.54a1 1 0 0 0-1.12-.58 10.84 10.84 0 0 0-4.6 2.26 1 1 0 0 0-.25 1.4l.93 1.36c.13.19.13.42 0 .61a10.85 10.85 0 0 0-1.32 9 1 1 0 0 0 .89 1.18 10.84 10.84 0 0 0 8.86 0 1 1 0 0 0 .89-1.18Z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 9v-6" />
    <path d="m15 10.5 4.5-2.5" />
    <path d="m15 13.5 4.5 2.5" />
    <path d="M12 15v6" />
    <path d="m9 13.5-4.5 2.5" />
    <path d="m9 10.5-4.5-2.5" />
  </svg>
);
