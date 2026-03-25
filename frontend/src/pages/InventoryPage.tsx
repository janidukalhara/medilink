import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Search, Edit3, Trash2, Save, X,
  CheckCircle, AlertTriangle, Loader2, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';
import { pharmacyAPI } from '../services/api';

interface Item {
  _id?: string;
  medicineName: string;
  genericName?: string;
  brand?: string;
  category?: string;
  form?: string;
  dosageStrength?: string;
  unitPrice: number;
  stockQuantity: number;
  isAvailable: boolean;
  aliases?: string[];
}

const FORMS = ['tablet', 'capsule', 'syrup', 'injection', 'cream', 'drops', 'inhaler', 'other'];
const CATEGORIES = ['Antibiotic', 'Analgesic', 'NSAID', 'Antidiabetic', 'CCB', 'Beta-blocker',
  'ACE Inhibitor', 'ARB', 'Diuretic', 'Statin', 'Antiplatelet', 'Antihistamine',
  'Corticosteroid', 'PPI', 'Antiemetic', 'Bronchodilator', 'Vitamin', 'Supplement', 'Other'];

const EMPTY_ITEM: Item = {
  medicineName: '', genericName: '', brand: '', category: '', form: 'tablet',
  dosageStrength: '', unitPrice: 0, stockQuantity: 0, isAvailable: true, aliases: [],
};

export default function InventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Item>(EMPTY_ITEM);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<Item>(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await pharmacyAPI.getInventory({ search, limit: 100 });
      setItems(data.items);
      setTotal(data.total);
    } catch { } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(); }, [load]);

  const save = async (item: Item) => {
    setSaving(true);
    try {
      if (item._id) {
        await pharmacyAPI.updateItem(item._id, item);
        toast.success('Updated');
        setEditingId(null);
      } else {
        await pharmacyAPI.addItem(item);
        toast.success('Medicine added');
        setShowAddForm(false);
        setAddForm(EMPTY_ITEM);
      }
      load();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const del = async (id: string) => {
    if (!confirm('Remove this item from inventory?')) return;
    setDeleting(id);
    try {
      await pharmacyAPI.deleteItem(id);
      toast.success('Removed');
      load();
    } catch { toast.error('Failed'); }
    finally { setDeleting(null); }
  };

  const ItemRow = ({ item }: { item: Item }) => {
    const isEditing = editingId === item._id;
    const form = isEditing ? editForm : item;
    const setF = (field: keyof Item, val: any) => setEditForm(p => ({ ...p, [field]: val }));

    return (
      <tr className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${!item.isAvailable ? 'opacity-60' : ''}`}>
        <td className="p-3">
          {isEditing
            ? <input className="input text-sm" value={form.medicineName} onChange={e => setF('medicineName', e.target.value)} />
            : <div>
                <p className="font-medium text-sm">{item.medicineName}</p>
                {item.genericName && <p className="text-xs text-gray-400">{item.genericName}</p>}
              </div>
          }
        </td>
        <td className="p-3">
          {isEditing
            ? <input className="input text-sm w-24" value={form.dosageStrength || ''} onChange={e => setF('dosageStrength', e.target.value)} />
            : <span className="text-sm text-gray-600">{item.dosageStrength || '—'}</span>
          }
        </td>
        <td className="p-3">
          {isEditing
            ? <select className="input text-sm" value={form.form || ''} onChange={e => setF('form', e.target.value)}>
                {FORMS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            : <span className="badge bg-gray-100 text-gray-600 capitalize">{item.form || '—'}</span>
          }
        </td>
        <td className="p-3">
          {isEditing
            ? <input type="number" className="input text-sm w-28" min={0} step={0.5}
                value={form.unitPrice} onChange={e => setF('unitPrice', parseFloat(e.target.value) || 0)} />
            : <span className="font-medium text-sm">LKR {item.unitPrice?.toFixed(2)}</span>
          }
        </td>
        <td className="p-3">
          {isEditing
            ? <input type="number" className="input text-sm w-20" min={0}
                value={form.stockQuantity} onChange={e => setF('stockQuantity', parseInt(e.target.value) || 0)} />
            : <span className={`text-sm font-medium ${item.stockQuantity === 0 ? 'text-red-500' : item.stockQuantity < 10 ? 'text-yellow-600' : 'text-green-600'}`}>
                {item.stockQuantity}
              </span>
          }
        </td>
        <td className="p-3">
          {isEditing
            ? <input type="checkbox" checked={form.isAvailable}
                onChange={e => setF('isAvailable', e.target.checked)} className="w-4 h-4 accent-primary-600" />
            : (item.isAvailable
                ? <CheckCircle className="w-4 h-4 text-green-500" />
                : <AlertTriangle className="w-4 h-4 text-red-400" />)
          }
        </td>
        <td className="p-3">
          <div className="flex items-center gap-1">
            {isEditing ? (
              <>
                <button onClick={() => save({ ...form, _id: item._id })} disabled={saving}
                  className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => setEditingId(null)}
                  className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200">
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => { setEditingId(item._id!); setEditForm(item); }}
                  className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => del(item._id!)} disabled={deleting === item._id}
                  className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100">
                  {deleting === item._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const AddForm = () => (
    <tr className="border-b border-primary-100 bg-primary-50">
      <td className="p-2"><input className="input text-sm" placeholder="Medicine name *" value={addForm.medicineName} onChange={e => setAddForm(p => ({ ...p, medicineName: e.target.value }))} /></td>
      <td className="p-2"><input className="input text-sm" placeholder="e.g. 500mg" value={addForm.dosageStrength || ''} onChange={e => setAddForm(p => ({ ...p, dosageStrength: e.target.value }))} /></td>
      <td className="p-2">
        <select className="input text-sm" value={addForm.form} onChange={e => setAddForm(p => ({ ...p, form: e.target.value }))}>
          {FORMS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </td>
      <td className="p-2"><input type="number" className="input text-sm" min={0} placeholder="Unit price" value={addForm.unitPrice || ''} onChange={e => setAddForm(p => ({ ...p, unitPrice: parseFloat(e.target.value) || 0 }))} /></td>
      <td className="p-2"><input type="number" className="input text-sm" min={0} placeholder="Stock qty" value={addForm.stockQuantity || ''} onChange={e => setAddForm(p => ({ ...p, stockQuantity: parseInt(e.target.value) || 0 }))} /></td>
      <td className="p-2"><CheckCircle className="w-4 h-4 text-green-500" /></td>
      <td className="p-2">
        <div className="flex gap-1">
          <button onClick={() => save(addForm)} disabled={saving || !addForm.medicineName}
            className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => { setShowAddForm(false); setAddForm(EMPTY_ITEM); }}
            className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-display font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-primary-600" /> Medicine Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} items · Used for auto-quotation generation
          </p>
        </div>
        <button onClick={() => setShowAddForm(true)}
          className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Medicine
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9 w-full sm:w-80"
          placeholder="Search medicines..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Info banner */}
      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl mb-4 text-sm text-blue-700">
        💡 <strong>Tip:</strong> Keep your inventory up-to-date. When a patient requests a quote,
        the system will auto-match their medicines against your inventory and pre-fill prices.
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Medicine', 'Strength', 'Form', 'Unit Price', 'Stock', 'Available', 'Actions'].map(h => (
                  <th key={h} className="text-left p-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {showAddForm && <AddForm />}
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500 mx-auto" />
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-16">
                  <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No medicines in inventory yet</p>
                  <button onClick={() => setShowAddForm(true)} className="btn-primary mt-3 text-sm">
                    <Plus className="w-4 h-4 inline mr-1" /> Add First Medicine
                  </button>
                </td></tr>
              ) : (
                items.map(item => <ItemRow key={item._id} item={item} />)
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
