import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { QuestionReview } from '../components/QuestionForm';
import LoadingSpinner from '../components/LoadingSpinner';
import TeacherSurveyModal from '../components/TeacherSurveyModal';
import ScoreHistoryChart from '../components/ScoreHistoryChart';
import { 
  BarChart3, 
  TrendingUp, 
  Trophy, 
  Edit, 
  Target, 
  Calendar, 
  FileText, 
  X,
  Headphones,
  BookOpen,
  PenTool,
  Mic,
  Award,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

// Modern Lucide icons for professional look
const Icons = {
  stats: () => <BarChart3 className="w-6 h-6" />,
  chart: () => <TrendingUp className="w-6 h-6" />,
  trophy: () => <Trophy className="w-6 h-6" />,
  edit: () => <Edit className="w-6 h-6" />,
  target: () => <Target className="w-6 h-6" />,
  calendar: () => <Calendar className="w-6 h-6" />,
  document: () => <FileText className="w-6 h-6" />,
  close: () => <X className="w-5 h-5" />,
  listening: () => <Headphones className="w-6 h-6" />,
  reading: () => <BookOpen className="w-6 h-6" />,
  writing: () => <PenTool className="w-6 h-6" />,
  speaking: () => <Mic className="w-6 h-6" />,
  award: () => <Award className="w-6 h-6" />,
  clock: () => <Clock className="w-6 h-6" />,
  check: () => <CheckCircle className="w-6 h-6" />,
  alert: () => <AlertCircle className="w-6 h-6" />
};

// IELTS-style band score rounding
const roundToIELTSBand = (score) => {
  if (score === null || score === undefined) return null;
  
  // Round to nearest 0.25, then convert to IELTS scale
  const rounded = Math.round(score * 4) / 4;
  
  // IELTS rounding rules:
  // .25 rounds to .5
  // .75 rounds to next whole number
  // .5 stays .5
  const decimal = rounded % 1;
  const whole = Math.floor(rounded);
  
  if (decimal === 0.25) {
    return whole + 0.5;
  } else if (decimal === 0.75) {
    return whole + 1;
  } else {
    return rounded;
  }
};

export default function Dashboard() {
  const [essays, setEssays] = useState([]);
  const [listeningSessions, setListeningSessions] = useState([]);
  const [readingSessions, setReadingSessions] = useState([]);
  const [speakingSessions, setSpeakingSessions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showAllTests, setShowAllTests] = useState(false);
  const [showSurveyModal, setShowSurveyModal] = useState(false);
  const [surveyStatus, setSurveyStatus] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [diagnosticSummary, setDiagnosticSummary] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem('role');
    setUserRole(role);
  }, []);

  useEffect(() => {
    let isMounted = true;
    
    const fetchAll = async () => {
      if (!isMounted) return;
      
      try {
        const [essRes, listenRes, readingRes, speakingRes, summaryRes] = await Promise.all([
          api.get('/essays/'),
          api.get('/listening/sessions/'),
          api.get('/reading/sessions/'),
          api.get('/speaking/sessions/'),
          api.get('/dashboard/summary/')
        ]);
        
        if (isMounted) {
          const essaysData = essRes.data.essays || essRes.data;
          
          // Teacher feedback уже включен в /essays/ ответ через EssaySerializer
          // Нет необходимости делать дополнительные запросы
          setEssays(essaysData);
          setListeningSessions(listenRes.data);
          setReadingSessions(readingRes.data);
          setSpeakingSessions(speakingRes.data.sessions || speakingRes.data || []);
          setSummary(summaryRes.data);
          setDiagnosticSummary(summaryRes.data.diagnostic || null);
        }
      } catch (err) {
        console.error('Error loading history:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    const loadSurveyStatus = async () => {
      try {
        const response = await api.get('/teacher-survey/');
        if (isMounted) {
          setSurveyStatus(response.data);
        }
      } catch (err) {
        console.error('Failed to load survey status:', err);
      }
    };
    
    fetchAll();
    loadSurveyStatus();
    
    // Слушаем событие о заполнении опроса
    const handleSurveySubmitted = () => {
      loadSurveyStatus();
    };
    
    window.addEventListener('surveySubmitted', handleSurveySubmitted);
    
    const handleListeningHistoryUpdated = () => {
      if (!isMounted) return;
      
      api.get('/listening/sessions/')
        .then(res => {
          if (isMounted) {
            setListeningSessions(res.data);
          }
        })
        .catch(err => console.error('Error updating listening:', err));
    };
    
    window.addEventListener('listeningHistoryUpdated', handleListeningHistoryUpdated);
    
    return () => {
      isMounted = false;
      window.removeEventListener('listeningHistoryUpdated', handleListeningHistoryUpdated);
      window.removeEventListener('surveySubmitted', handleSurveySubmitted);
    };
  }, []);

  const handleOpenDetails = async (item) => {
    setSelectedItem(item);
    if (item.type === 'Listening') {
      setDetailsLoading(true);
      try {
        const res = await api.get(`/listening/sessions/${item.item.id}/`);
        setItemDetails(res.data);
      } catch (err) {
        console.error("Failed to load session details", err);
        setItemDetails(null); 
      } finally {
        setDetailsLoading(false);
      }
    } else if (item.type === 'Reading') {
      setDetailsLoading(true);
      try {
        const res = await api.get(`/reading-sessions/${item.item.id}/result/`);
        setItemDetails(res.data);
      } catch (err) {
        console.error("Failed to load Reading session details", err);
        setItemDetails(null); 
      } finally {
        setDetailsLoading(false);
      }
    } else if (item.type === 'Writing') {
      // Для Writing тестов переходим на страницу результатов сессии
      if (item.session_id) {
        navigate(`/writing/result/${item.session_id}`);
      } else {
        // Fallback для старых эссе без сессии
        navigate(`/writing/essay/${item.essays[0].id}`);
      }
      return;
    } else {
      setItemDetails(item.item);
    }
  };

  const handleCloseDetails = () => {
    setSelectedItem(null);
    setItemDetails(null);
  };

  const handleShowAllTests = () => {
    setShowAllTests(!showAllTests);
  };

  const allSessions = [
    ...listeningSessions.map(item => ({
        type: 'Listening',
        item,
        date: item.completed_at || item.started_at,
        raw_score: item.correct_answers_count,
        total_score: item.total_questions_count,
        band_score: roundToIELTSBand(item.band_score),
        test_title: item.test_title,
    })),
    ...readingSessions.map(item => ({
        type: 'Reading',
        item,
        date: item.submitted_at || item.start_time,
        raw_score: item.correct_answers_count,
        total_score: item.total_questions_count,
        band_score: roundToIELTSBand(item.band_score),
        test_title: item.test_title,
    })),
    ...speakingSessions.map(item => ({
        type: 'Speaking',
        item,
        date: item.conducted_at,
        raw_score: null,
        total_score: null,
        band_score: roundToIELTSBand(item.overall_band_score),
        test_title: 'Speaking Assessment',
    })),
    // Group Writing essays by test_session to show as single tests
    ...Object.values(
      essays.reduce((acc, essay) => {
        const sessionKey = essay.test_session?.id ? essay.test_session.id.toString() : `single_${essay.id}`;
        
        if (!acc[sessionKey]) {
          acc[sessionKey] = {
            type: 'Writing',
            session_id: essay.test_session?.id || null,
            date: essay.submitted_at,
            essays: [],
            test_title: essay.test_session?.test_title || 'IELTS Writing Test'
          };
        }
        
        acc[sessionKey].essays.push(essay);
        // Update date to latest submission
        if (essay.submitted_at && (!acc[sessionKey].date || essay.submitted_at > acc[sessionKey].date)) {
          acc[sessionKey].date = essay.submitted_at;
        }
        
        return acc;
      }, {})
    ).map(writingSession => {
      // Calculate overall band score from both tasks
      const validBands = writingSession.essays
        .map(e => e.overall_band)
        .filter(band => band !== null && band !== undefined);
      
      const avgBand = validBands.length > 0 
        ? (validBands.reduce((sum, band) => sum + band, 0) / validBands.length)
        : null;

      return {
        ...writingSession,
        raw_score: writingSession.essays.length,
        total_score: 2,
        band_score: roundToIELTSBand(avgBand)
      };
    })
  ].sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(0);
    const dateB = b.date ? new Date(b.date) : new Date(0);
    return dateB - dateA;
  });

  // Отладочная информация для allSessions
  console.log('🔍 DEBUG allSessions:', allSessions.length);
  allSessions.forEach((session, idx) => {
    console.log(`Session ${idx + 1}:`, {
      type: session.type,
      title: session.test_title,
      band_score: session.band_score,
      date: session.date
    });
  });

  const getStats = () => {
    // Отладочная информация
    console.log('🔍 DEBUG getStats:');
    console.log('Essays:', essays.length, essays.map(e => ({ id: e.id, overall_band: e.overall_band })));
    console.log('Listening:', listeningSessions.length, listeningSessions.map(l => ({ id: l.id, score: l.score, band_score: l.band_score })));
    console.log('Reading:', readingSessions.length, readingSessions.map(r => ({ id: r.id, band_score: r.band_score })));
    console.log('Speaking:', speakingSessions.length, speakingSessions.map(s => ({ id: s.id, band_score: s.overall_band_score })));
    
    const scores = [
      ...essays.map(e => e.overall_band).filter(Boolean),
      ...listeningSessions.map(l => l.band_score).filter(Boolean),
      ...readingSessions.map(r => r.band_score).filter(Boolean),
      ...speakingSessions.map(s => s.overall_band_score).filter(Boolean)
    ];
    
    console.log('Filtered scores:', scores);
    
    const avg = scores.length ? roundToIELTSBand(scores.reduce((a, b) => a + b) / scores.length) : '-';
    const max = scores.length ? roundToIELTSBand(Math.max(...scores)) : '-';
    
    const result = { count: scores.length, avg, max };
    console.log('Result:', result);
    
    return result;
  };

  const { count, avg, max } = getStats();


  const prepareScoreHistory = () => {
    const history = [];
    
    // Listening
    listeningSessions.forEach(session => {
      if (session.band_score) {
        history.push({
          date: session.completed_at || session.started_at,
          type: 'listening',
          band_score: session.band_score,
          test_title: session.test_title
        });
      }
    });
    
    // Reading
    readingSessions.forEach(session => {
      if (session.band_score) {
        history.push({
          date: session.submitted_at || session.start_time,
          type: 'reading',
          band_score: session.band_score,
          test_title: session.test_title
        });
      }
    });
    
    // Writing - только с teacher feedback
    essays.forEach(essay => {
      if (essay.teacher_feedback?.teacher_overall_score) {
        history.push({
          date: essay.submitted_at,
          type: 'writing',
          band_score: essay.teacher_feedback.teacher_overall_score,
          test_title: essay.test_session?.test_title || 'Writing Test'
        });
      }
    });
    
    // Сортировка по дате
    return history.sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  if (loading) {
          return (
      <div className="p-3 sm:p-4 md:p-8 lg:p-10 max-w-full md:max-w-7xl mx-auto">
              <LoadingSpinner fullScreen text="Loading..." />
            </div>
          );
        }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-white to-blue-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-blue-600 bg-clip-text text-transparent">
                Welcome Back!
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Ready for new achievements?
              </p>
            </div>
        <button
          onClick={() => navigate('/writing/start')}
              className="mt-6 sm:mt-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 flex items-center gap-3 shadow-lg hover:shadow-xl transform hover:scale-105"
        >
              <Icons.edit />
              <span className="font-semibold">Start New Test</span>
        </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Section KPI Cards (Listening / Reading / Writing) */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard 
              title="Listening (30d)" 
              value={
                summary?.listening?.avg?.band_30d != null
                  ? roundToIELTSBand(summary.listening.avg.band_30d)
                  : (summary?.listening?.accuracy?.avg_30d_percent != null
                      ? `${Math.round(summary.listening.accuracy.avg_30d_percent)}%`
                      : '-')
              } 
              icon={<Icons.chart />} 
              description={
                summary?.listening?.avg?.band_30d != null
                  ? `Completed: ${summary?.listening?.totals?.completed_30d ?? 0}`
                  : `Avg Accuracy: ${summary?.listening?.accuracy?.avg_30d_percent != null ? Math.round(summary.listening.accuracy.avg_30d_percent) + '%' : '-'}`
              }
              trend={
                summary?.listening?.last_result?.band != null
                  ? `${roundToIELTSBand(summary.listening.last_result.band)} last`
                  : (summary?.listening?.accuracy?.last_test_percent != null ? `${Math.round(summary.listening.accuracy.last_test_percent)}% last` : null)
              }
              color="blue"
              extra={summary?.listening?.accuracy?.last_test_percent != null ? (
                <div className="mt-3">
                  <AccuracyRing percent={summary.listening.accuracy.last_test_percent} color="blue" label="Accuracy" />
                </div>
              ) : null}
            />
            <StatCard 
              title="Reading Avg (30d)" 
              value={
                summary?.reading?.avg?.band_30d != null
                  ? roundToIELTSBand(summary.reading.avg.band_30d)
                  : (summary?.reading?.avg?.score_30d != null ? Math.round(summary.reading.avg.score_30d * 10) / 10 : '-')
              } 
              icon={<Icons.stats />} 
              description={`Completed: ${summary?.reading?.totals?.completed_30d ?? 0}`}
              trend={
                summary?.reading?.last_result?.band != null
                  ? `${roundToIELTSBand(summary.reading.last_result.band)} last`
                  : (summary?.reading?.last_result?.score != null ? `${Math.round(summary.reading.last_result.score * 10) / 10} last` : null)
              }
              color="emerald"
              extra={summary?.reading?.accuracy?.last_test_percent != null ? (
                <div className="mt-3">
                  <AccuracyRing percent={summary.reading.accuracy.last_test_percent} color="emerald" label="Accuracy" />
                </div>
              ) : null}
            />
            <StatCard 
              title="Writing Avg (30d)" 
              value={summary?.writing?.avg?.overall_band_30d != null ? roundToIELTSBand(summary.writing.avg.overall_band_30d) : '-'} 
              icon={<Icons.trophy />} 
              description={`Essays: ${summary?.writing?.totals?.essays_30d ?? 0}`}
              trend={summary?.writing?.last_feedback?.teacher_overall_score != null ? `${summary.writing.last_feedback.teacher_overall_score} feedback` : null}
              color="purple"
            />
          </div>
        )}

        {/* Diagnostic Test Block */}
        {diagnosticSummary && !diagnosticSummary.locked && diagnosticSummary.completed_count < 3 && (
          <div className="relative bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200 rounded-2xl p-8 mb-8 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full opacity-20 transform translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-100 to-blue-100 rounded-full opacity-20 transform -translate-x-12 translate-y-12"></div>
            
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                 
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-800 to-indigo-800 bg-clip-text text-transparent">
                    Diagnostic Test
                  </h3>
                </div>
                <p className="text-blue-700 text-base mb-4 leading-relaxed">
                  Take a comprehensive diagnostic test to establish your baseline skills across all IELTS modules.
                </p>
                <div className="flex flex-wrap gap-3">
                  <span className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 ${diagnosticSummary.listening?.band ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                    <Icons.listening className="w-4 h-4" />
                    Listening {diagnosticSummary.listening?.band ? <Icons.check className="w-4 h-4" /> : <Icons.clock className="w-4 h-4" />}
                  </span>
                  <span className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 ${diagnosticSummary.reading?.band ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                    <Icons.reading className="w-4 h-4" />
                    Reading {diagnosticSummary.reading?.band ? <Icons.check className="w-4 h-4" /> : <Icons.clock className="w-4 h-4" />}
                  </span>
                  <span className={`px-3 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 ${diagnosticSummary.writing?.band ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                    <Icons.writing className="w-4 h-4" />
                    Writing {diagnosticSummary.writing?.band ? <Icons.check className="w-4 h-4" /> : <Icons.clock className="w-4 h-4" />}
                  </span>
                </div>
              </div>
              <div className="mt-6 sm:mt-0">
                <button
                  onClick={() => navigate('/diagnostic')}
                  className="px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center gap-3 transform hover:scale-105"
                >
                 
                  {diagnosticSummary.completed_count === 0 ? 'Start Diagnostic' : 'Continue Diagnostic'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Diagnostic Results Block */}
        {diagnosticSummary && diagnosticSummary.completed_count === 3 && (
          <div className="relative bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border border-green-200 rounded-2xl p-8 mb-8 shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full opacity-20 transform translate-x-16 -translate-y-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-teal-100 to-green-100 rounded-full opacity-20 transform -translate-x-12 translate-y-12"></div>
            
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Icons.award className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-green-800 to-emerald-800 bg-clip-text text-transparent">
                    Diagnostic Complete
                  </h3>
                </div>
                <p className="text-green-700 text-base mb-4">
                  Overall Band Score: <span className="font-bold text-2xl text-green-800">{diagnosticSummary.overall_band || 'N/A'}</span>
                </p>
                <div className="flex flex-wrap gap-4 text-sm font-medium">
                  <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg border border-green-200">
                    L: {diagnosticSummary.listening?.band || 'N/A'}
                  </span>
                  <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg border border-green-200">
                    R: {diagnosticSummary.reading?.band || 'N/A'}
                  </span>
                  <span className="px-3 py-2 bg-green-100 text-green-700 rounded-lg border border-green-200">
                    W: {diagnosticSummary.writing?.band || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="mt-6 sm:mt-0 flex flex-wrap gap-2">
                {diagnosticSummary.listening?.session_id && (
                  <button
                    onClick={() => navigate(`/listening-result/${diagnosticSummary.listening.session_id}`)}
                    className="px-4 py-2 rounded-lg font-medium transition-all duration-200 bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <Icons.listening className="w-4 h-4" />
                    View L
                  </button>
                )}
                {diagnosticSummary.reading?.session_id && (
                  <button
                    onClick={() => navigate(`/reading-result/${diagnosticSummary.reading.session_id}`)}
                    className="px-4 py-2 rounded-lg font-medium transition-all duration-200 bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <Icons.reading className="w-4 h-4" />
                    View R
                  </button>
                )}
                {diagnosticSummary.writing?.session_id && (
                  <button
                    onClick={() => navigate(`/writing-result/${diagnosticSummary.writing.session_id}`)}
                    className="px-4 py-2 rounded-lg font-medium transition-all duration-200 bg-green-600 hover:bg-green-700 text-white text-sm flex items-center gap-2 shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <Icons.writing className="w-4 h-4" />
                    View W
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Teacher Survey Block (moved between KPI rows) */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border border-orange-200 rounded-xl p-6 mb-8 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-orange-800 mb-2">
                Weekly Teacher Survey
              </h3>
              <p className="text-orange-700 text-sm">
                Tell us if you're satisfied with your teacher. It only takes 20 seconds.
              </p>
            </div>
            <div className="mt-4 sm:mt-0">
              {surveyStatus?.submittedThisWeek ? (
                <div className="px-4 py-2 rounded-lg text-sm font-medium bg-green-100 text-green-700">
                  Submitted this week
                </div>
              ) : (
                <button
                  onClick={() => setShowSurveyModal(true)}
                  className="px-6 py-2 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Complete Survey
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Statistical Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <StatCard 
            title="Tests Completed" 
            value={count} 
            icon={<Icons.stats />}
            description="Total completed"
            trend={null}
            color="slate"
          />
          <StatCard 
            title="Average Score" 
            value={avg} 
            icon={<Icons.chart />}
            description="Your progress"
            trend={null}
            color="indigo"
          />
          <StatCard 
            title="Best Result" 
            value={max} 
            icon={<Icons.trophy />}
            description="Maximum score"
            trend={null}
            color="emerald"
          />
        </div>


        {/* Main content in two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Progress and analytics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Score History Chart */}
            {userRole === 'student' && (
              <ScoreHistoryChart data={prepareScoreHistory()} />
            )}

            {/* Test History */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-white to-gray-50 rounded-t-xl">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <div className="w-2 h-6 bg-gradient-to-b from-indigo-500 to-purple-600 rounded-full mr-3"></div>
                  Recent Tests
                </h3>
              </div>
              <div className="p-6">
        
                {allSessions.length > 0 ? (
                  <div className="space-y-4">
                    {(showAllTests ? allSessions : allSessions.slice(0, 5)).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 border border-gray-200 hover:border-blue-200 hover:shadow-md">
                        <div className="flex items-center space-x-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-lg ${
                            item.type === 'Listening' ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' :
                            item.type === 'Reading' ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white' :
                            item.type === 'Speaking' ? 'bg-gradient-to-br from-orange-500 to-red-600 text-white' :
                            'bg-gradient-to-br from-purple-500 to-purple-600 text-white'
                          }`}>
                            {item.type === 'Listening' ? (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 9H4a1 1 0 00-1 1v4a1 1 0 001 1h1.586l4.707 4.707C10.923 20.337 12 19.907 12 19V5c0-.907-1.077-1.337-1.707-.707L5.586 9z" />
                              </svg>
                            ) : item.type === 'Reading' ? (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                              </svg>
                            ) : item.type === 'Speaking' ? (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                              </svg>
                            ) : (
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            )}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900">{item.test_title || 'Practice'}</h4>
                            <p className="text-sm text-gray-500">
                              {item.date ? new Date(item.date).toLocaleDateString() : 'No date'}
                            </p>
                          </div>
                        </div>
                                                <div className="flex items-center space-x-4">
                                                    <div className="text-right">
                            <>
                              <div className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                                {item.band_score || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500 font-medium">score</div>
                            </>
            </div>
              {item.type === 'Reading' && item.item.id && (
                            <button onClick={() => navigate(`/reading-result/${item.item.id}`)} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105">
                              Details
                            </button>
              )}
              {item.type === 'Listening' && item.item.id && (
                            <button onClick={() => navigate(`/listening-result/${item.item.id}`)} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105">
                              Details
                            </button>
              )}
              {item.type === 'Speaking' && item.item.id && (
                            <button onClick={() => navigate(`/speaking/result/${item.item.id}`)} className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105">
                              Details
                            </button>
              )}
              {item.type === 'Writing' && (
                            <button onClick={() => handleOpenDetails(item)} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:from-blue-600 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-105">
                              Details
                            </button>
              )}
            </div>
          </div>
        ))}
                    {allSessions.length > 5 && (
                      <div className="text-center pt-4">
                        <button 
                          onClick={handleShowAllTests}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium hover:underline transition-all duration-200"
                        >
                          {showAllTests ? 'Show Less' : 'Show All Tests →'}
                        </button>
      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-gray-500">No tests completed yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right column - Quick Actions */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <div className="w-2 h-6 bg-gradient-to-b from-purple-500 to-pink-600 rounded-full mr-3"></div>
                                  Quick Actions
              </h3>
              <div className="space-y-3">
                <button
                  onClick={() => navigate('/listening')}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl transition-all duration-200 group border border-blue-200 hover:border-blue-300 hover:shadow-lg transform hover:scale-105"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 9H4a1 1 0 00-1 1v4a1 1 0 001 1h1.586l4.707 4.707C10.923 20.337 12 19.907 12 19V5c0-.907-1.077-1.337-1.707-.707L5.586 9z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-blue-900">Listening Test</span>
                  </div>
                  <svg className="w-5 h-5 text-blue-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                <button
                  onClick={() => navigate('/reading')}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-emerald-100 hover:from-emerald-100 hover:to-emerald-200 rounded-xl transition-all duration-200 group border border-emerald-200 hover:border-emerald-300 hover:shadow-lg transform hover:scale-105"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                    <span className="font-semibold text-emerald-900">Reading Test</span>
                  </div>
                  <svg className="w-5 h-5 text-emerald-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                
                <button
                  onClick={() => navigate('/writing/start')}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all duration-200 group border border-purple-200 hover:border-purple-300 hover:shadow-lg transform hover:scale-105"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl flex items-center justify-center shadow-lg">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                    <span className="font-semibold text-purple-900">Writing Test</span>
                  </div>
                  <svg className="w-5 h-5 text-purple-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Useful links or tips */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
                <div className="w-2 h-6 bg-gradient-to-b from-orange-500 to-red-600 rounded-full mr-3"></div>
                                  Recommendations
              </h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                  <div className="w-8 h-8 bg-gradient-to-br from-yellow-500 to-orange-500 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-orange-900">Regular Practice</p>
                    <p className="text-xs text-orange-700">Take tests every day for better results</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">Error Analysis</p>
                    <p className="text-xs text-indigo-700">Study your mistakes in detailed results</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-500 text-white rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Weekly Goal</p>
                    <p className="text-xs text-emerald-700">Try to improve your score by 0.5 points</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reading Modal */}
      {selectedItem && selectedItem.type === 'Reading' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Reading Test Results</h3>
              <button onClick={handleCloseDetails} className="text-gray-400 hover:text-gray-600 transition-colors">
                <Icons.close />
              </button>
            </div>
            {detailsLoading ? (
              <div className="text-center py-8">
                <LoadingSpinner text="Loading..." />
              </div>
            ) : itemDetails ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Result</p>
                    <p className="text-2xl font-bold text-gray-900">{itemDetails.raw_score} / {itemDetails.total_score}</p>
                    </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Band Score</p>
                    <p className="text-2xl font-bold text-gray-900">{itemDetails.band_score}</p>
                    </div>
                </div>

                <div className="mb-6 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => navigate(`/reading-result/${selectedItem.item.id}`)}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    View Full Results
                  </button>
                  {itemDetails?.explanation_url && (
                    <a
                      href={itemDetails.explanation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 rounded-lg font-medium border border-emerald-200 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                    >
                      Test explanation
                    </a>
                  )}
                </div>
              </>
            ) : <p className="text-red-600 text-center py-4">Failed to load details.</p>}
          </div>
        </div>
      )}

      {/* Listening Modal */}
      {selectedItem && selectedItem.type === 'Listening' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Results: {selectedItem.item.test_title}</h3>
              <button onClick={handleCloseDetails} className="text-gray-400 hover:text-gray-600 transition-colors">
                <Icons.close />
              </button>
            </div>

            {detailsLoading ? (
              <div className="text-center py-8">
                <LoadingSpinner text="Loading..." />
              </div>
            ) : itemDetails ? (
              <>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Correct Answers</p>
                    <p className="text-2xl font-bold text-gray-900">{itemDetails.correct_answers_count} / {itemDetails.total_questions_count}</p>
                    </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600 mb-1">Band Score</p>
                    <p className="text-2xl font-bold text-gray-900">{itemDetails.band_score}</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
                  {itemDetails?.explanation_url && (
                    <a
                      href={itemDetails.explanation_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 rounded-lg font-medium border border-blue-200 text-blue-700 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      Test explanation
                    </a>
                  )}
                </div>
                <h3 className="text-lg font-semibold border-b border-gray-200 pb-3 mb-6 text-gray-900">Detailed Analysis</h3>
                {itemDetails.test_render_structure && Array.isArray(itemDetails.test_render_structure) ? (
                  <div className="space-y-6">
                    {itemDetails.test_render_structure.map((part, partIdx) => (
                      <div key={partIdx} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                        <h4 className="text-base font-semibold mb-3 text-gray-900">
                          Part {part.part_number}
                          {part.instructions && (
                            <span className="text-sm font-normal text-gray-600 ml-2">— {part.instructions}</span>
                          )}
                        </h4>
                        <div className="space-y-4">
                          {part.questions.map((q, qIdx) => (
                            <div key={q.id || qIdx} className="mb-4">
                              {q.header && <div className="font-medium text-gray-700 mb-1">{q.header}</div>}
                              {q.instruction && <div className="text-xs text-gray-500 mb-1 italic">{q.instruction}</div>}
                              <QuestionReview question={q} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">Detailed analysis not available.</p>
                )}
              </>
            ) : <p className="text-red-600 text-center py-4">Failed to load details.</p>}
          </div>
        </div>
      )}

      {/* Teacher Survey Modal */}
      <TeacherSurveyModal
        isOpen={showSurveyModal}
        onClose={() => setShowSurveyModal(false)}
        onSurveySubmitted={async () => {
          // Обновляем статус опроса в Dashboard
          try {
            const response = await api.get('/teacher-survey/');
            setSurveyStatus(response.data);
          } catch (err) {
            console.error('Failed to update survey status:', err);
          }
        }}
      />

    </div>
  );
}

function StatCard({ title, value, icon, description, trend, color = 'gray', extra = null }) {
  const colorMap = {
    blue: { gradient: 'from-blue-500 to-blue-600', accent: 'bg-blue-500' },
    emerald: { gradient: 'from-emerald-500 to-emerald-600', accent: 'bg-emerald-500' },
    purple: { gradient: 'from-purple-500 to-purple-600', accent: 'bg-purple-500' },
    indigo: { gradient: 'from-indigo-500 to-indigo-600', accent: 'bg-indigo-500' },
    slate: { gradient: 'from-slate-500 to-slate-600', accent: 'bg-slate-500' },
    gray: { gradient: 'from-gray-500 to-gray-600', accent: 'bg-gray-500' },
  };
  const style = colorMap[color] || colorMap.gray;

  const trendPositive = typeof trend === 'string' && trend.startsWith('+');

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-full h-1 ${style.accent}`}></div>
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 bg-gradient-to-br ${style.gradient} rounded-xl flex items-center justify-center text-white shadow-lg`}>
          {icon}
        </div>
        {trend && (
          <div className={`text-xs font-semibold px-2 py-1 rounded-full ${trendPositive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>
            {trend}
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
        <div className="text-sm font-semibold text-gray-700 mb-1">{title}</div>
        <div className="text-xs text-gray-500">{description}</div>
        {extra}
      </div>
    </div>
  );
}

function AccuracyRing({ percent, color = 'blue', label = 'Accuracy' }) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const dash = (clamped / 100) * circumference;

  const colorStroke = {
    blue: '#2563EB',
    emerald: '#059669',
    purple: '#7C3AED',
    gray: '#6B7280',
  }[color] || '#2563EB';

  return (
    <div className="flex items-center gap-3">
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r={radius} stroke="#E5E7EB" strokeWidth="6" fill="none" />
        <circle
          cx="24"
          cy="24"
          r={radius}
          stroke={colorStroke}
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 24 24)"
        />
        <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" fontSize="12" fill="#111827">
          {Math.round(clamped)}%
        </text>
      </svg>
      <div>
        <div className="text-xs font-semibold text-gray-700">{label}</div>
        <div className="text-[10px] text-gray-500">Last test</div>
      </div>
    </div>
  );
}
