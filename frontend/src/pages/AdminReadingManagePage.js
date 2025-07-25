import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent,
  Chip, IconButton, Switch, Alert, Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import api from '../api';
import { auth } from '../firebase';

const AdminReadingManagePage = () => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const navigate = useNavigate();

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    try {
      const response = await api.get('/reading-tests/');
      setTests(response.data);
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load tests', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleTestStatus = async (testId, isActive) => {
    try {
      await api.patch(`/reading-tests/${testId}/`, {
        is_active: isActive,
      });
      setTests(tests.map(test =>
        test.id === testId ? { ...test, is_active: isActive } : test
      ));
      setSnackbar({
        open: true,
        message: `Test ${isActive ? 'activated' : 'deactivated'} successfully`,
        severity: 'success'
      });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update test status', severity: 'error' });
    }
  };

  const deleteTest = async (testId) => {
    if (!window.confirm('Are you sure you want to delete this test?')) return;
    try {
      await api.delete(`/reading-tests/${testId}/`);
      setTests(tests.filter(test => test.id !== testId));
      setSnackbar({ open: true, message: 'Test deleted successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete test', severity: 'error' });
    }
  };

  const downloadCSV = async (testId, testTitle) => {
    try {
      const response = await api.get(`/admin/reading-test/${testId}/export-csv/`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `reading_test_${testId}_results.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: 'CSV downloaded successfully', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to download CSV', severity: 'error' });
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
        <Typography variant="h4">Reading Tests Management</Typography>
        <Link to="/admin/reading/builder/new" style={{ textDecoration: 'none' }}>
          <Button variant="contained" startIcon={<AddIcon />}>
            Create New Test
          </Button>
        </Link>
      </Box>

      {tests.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="h6" textAlign="center" color="text.secondary">
              No reading tests found
            </Typography>
            <Box textAlign="center" sx={{ mt: 2 }}>
              <Link to="/admin/reading/builder/new" style={{ textDecoration: 'none' }}>
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
                        label={`${test.parts?.length || 0} parts`}
                        variant="outlined"
                        size="small"
                      />
                      <Chip
                        label={`${test.parts?.reduce((total, part) => total + (part.questions?.length || 0), 0) || 0} questions`}
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                  </Box>
                  <Box display="flex" gap={1} alignItems="center">
                    <Switch
                      checked={test.is_active}
                      onChange={(e) => toggleTestStatus(test.id, e.target.checked)}
                      size="small"
                    />
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => downloadCSV(test.id, test.title)}
                      title="Download CSV"
                    >
                      <DownloadIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => navigate(`/admin/reading/builder/${test.id}`)}
                      title="Edit Test"
                    >
                      <EditIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => deleteTest(test.id)}
                      title="Delete Test"
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

export default AdminReadingManagePage;