import React, { useEffect, useState } from 'react';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const initialForm = {
  curator_id: '',
  first_name: '',
  last_name: '',
  email: '',
  password: '',
};

export default function AdminCuratorsPage() {
  const [curators, setCurators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    fetchCurators();
  }, []);

  const fetchCurators = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/curators/');
      setCurators(res.data);
    } catch (err) {
      setCurators([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      if (editId) {
        await api.patch(`/admin/curators/${editId}/`, form);
      } else {
        await api.post('/admin/create-curator/', { ...form, role: 'curator' });
      }
      setShowForm(false);
      setForm(initialForm);
      setEditId(null);
      fetchCurators();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Error saving curator');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = curator => {
    setForm({ ...curator, password: '' });
    setEditId(curator.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setFormLoading(true);
    try {
      await api.delete(`/admin/curators/${deleteId}/`);
      setShowDelete(false);
      setDeleteId(null);
      fetchCurators();
    } catch (err) {
      setFormError('Error deleting curator');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="p-10 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Curators</h1>
      <div className="mb-4 flex justify-end">
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          onClick={() => { setShowForm(true); setEditId(null); setForm(initialForm); }}
        >
          + Add Curator
        </button>
      </div>
      {loading ? (
        <LoadingSpinner fullScreen text="Loading..." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border rounded-xl overflow-hidden">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2">Curator ID</th>
                <th className="px-4 py-2">First Name</th>
                <th className="px-4 py-2">Last Name</th>
                <th className="px-4 py-2">Email</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {curators.map(c => (
                <tr key={c.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2">{c.curator_id || '-'}</td>
                  <td className="px-4 py-2">{c.first_name}</td>
                  <td className="px-4 py-2">{c.last_name}</td>
                  <td className="px-4 py-2">{c.email}</td>
                  <td className="px-4 py-2">
                    <button className="text-blue-600 hover:underline mr-2" onClick={() => handleEdit(c)}>Edit</button>
                    <button className="text-red-600 hover:underline" onClick={() => { setShowDelete(true); setDeleteId(c.id); }}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <form
            className="bg-white rounded-xl p-8 w-full max-w-xl shadow-xl"
            onSubmit={handleSubmit}
          >
            <h2 className="text-2xl font-bold mb-4">{editId ? 'Edit Curator' : 'Add New Curator'}</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input name="curator_id" value={form.curator_id} onChange={handleInput} placeholder="Curator ID *" className="border p-2 rounded" required />
              <input name="first_name" value={form.first_name} onChange={handleInput} placeholder="First Name *" className="border p-2 rounded" required />
              <input name="last_name" value={form.last_name} onChange={handleInput} placeholder="Last Name *" className="border p-2 rounded" required />
              <input name="email" value={form.email} onChange={handleInput} placeholder="Email *" className="border p-2 rounded" required type="email" />
              <input name="password" value={form.password} onChange={handleInput} placeholder="Password * (min 6 chars)" className="border p-2 rounded" type="password" minLength={editId ? 0 : 6} />
            </div>
            {formError && <div className="text-red-600 mb-2">{formError}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="px-4 py-2 rounded bg-gray-200" onClick={() => { setShowForm(false); setEditId(null); }} disabled={formLoading}>Cancel</button>
              <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" disabled={formLoading}>{formLoading ? (editId ? 'Saving...' : 'Creating...') : (editId ? 'Save' : 'Create Curator')}</button>
            </div>
          </form>
        </div>
      )}
      {showDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-xl text-center">
            <h2 className="text-xl font-bold mb-4">Delete Curator?</h2>
            <p className="mb-6">Are you sure you want to delete this curator? This action cannot be undone.</p>
            <div className="flex gap-2 justify-center">
              <button className="px-4 py-2 rounded bg-gray-200" onClick={() => { setShowDelete(false); setDeleteId(null); }} disabled={formLoading}>Cancel</button>
              <button className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700" onClick={handleDelete} disabled={formLoading}>{formLoading ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
