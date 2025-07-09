import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Box, Typography, Button, Card, CardContent, 
  Chip, IconButton, Switch, Alert, Snackbar 
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import { getAuth } from 'firebase/auth';

const AdminListeningManagePage = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const response = await fetch('/api/listening-tests/');
      if (response.ok) {
        const data = await response.json();
        setTests(data);
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load tests', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };
  
  const toggleTestStatus = async (testId, isActive) => {
    try {
      const response = await fetch(`/api/listening-tests/${testId}/`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_active: isActive }),
      });

      if (response.ok) {
        setTests(tests.map(test => 
          test.id === testId ? { ...test, is_active: isActive } : test
        ));
        setSnackbar({ 
          open: true, 
          message: `Test ${isActive ? 'activated' : 'deactivated'} successfully`, 
          severity: 'success' 
        });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update test status', severity: 'error' });
    }
  };

  const deleteTest = async (testId) => {
    if (!window.confirm('Are you sure you want to delete this test?')) return;

    try {
      const response = await fetch(`/api/listening-tests/${testId}/`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setTests(tests.filter(test => test.id !== testId));
        setSnackbar({ open: true, message: 'Test deleted successfully', severity: 'success' });
      }
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete test', severity: 'error' });
    }
  };

  // --- ДОБАВЛЕНО: экспорт CSV ---
  const handleExportCSV = async (testId, testTitle) => {
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        setSnackbar({ open: true, message: 'Not authenticated', severity: 'error' });
        return;
      }
      const token = await user.getIdToken();
      const response = await fetch(`/api/admin/listening-test/${testId}/export-csv/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!response.ok) {
        setSnackbar({ open: true, message: 'Failed to export CSV', severity: 'error' });
        return;
      }
      const blob = await response.blob();
      const filename = `listening_test_${testId}_results.csv`;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'CSV exported successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to export CSV', severity: 'error' });
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading tests...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">Listening Tests Management</Typography>
        <Link to="/admin/listening/builder/new" style={{ textDecoration: 'none' }}>
          <Button variant="contained" startIcon={<AddIcon />}>
            Create New Test
          </Button>
        </Link>
      </Box>

      {tests.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" textAlign="center" color="text.secondary">
              No listening tests found
            </Typography>
            <Box textAlign="center" sx={{ mt: 2 }}>
              <Link to="/admin/listening/builder/new" style={{ textDecoration: 'none' }}>
                <Button variant="contained" startIcon={<AddIcon />}>
                  Create Your First Test
                </Button>
              </Link>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: 'grid', gap: 2 }}>
          {tests.map((test) => (
            <Card key={test.id}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Typography variant="h6" gutterBottom>
                      {test.title}
                    </Typography>
                    <Box display="flex" gap={1} sx={{ mb: 2 }}>
                      <Chip 
                        label={test.is_active ? 'Active' : 'Inactive'} 
                        color={test.is_active ? 'success' : 'default'}
                        size="small"
                      />
                      <Chip 
                        label={`${test.parts?.length || 0} sections`} 
                        variant="outlined"
                        size="small"
                      />
                      <Chip 
                        label={`${test.parts?.reduce((total, part) => total + (part.questions?.length || 0), 0) || 0} questions`} 
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Created: {new Date(test.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" gap={1} alignItems="center">
                    <Switch
                      checked={test.is_active}
                      onChange={(e) => toggleTestStatus(test.id, e.target.checked)}
                      size="small"
                    />
                    <Link to={`/admin/listening/builder/${test.id}`} style={{ textDecoration: 'none' }}>
                      <IconButton size="small" color="primary">
                        <EditIcon />
                      </IconButton>
                    </Link>
                    <IconButton 
                      size="small" 
                      color="primary"
                      onClick={() => handleExportCSV(test.id, test.title)}
                      title="Export CSV"
                    >
                      <DownloadIcon />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      color="error"
                      onClick={() => deleteTest(test.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default AdminListeningManagePage;