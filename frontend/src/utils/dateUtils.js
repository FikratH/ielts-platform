// Утилиты для работы с датами и timezone
export const formatLocalDateTime = (dateString, options = {}) => {
  const date = new Date(dateString);
  
  const defaultOptions = {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return date.toLocaleString('ru-RU', defaultOptions);
};

export const formatLocalDate = (dateString) => {
  return formatLocalDateTime(dateString, {
    hour: undefined,
    minute: undefined
  });
};

export const getWeekStart = () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

export const isThisWeek = (dateString) => {
  const date = new Date(dateString);
  const weekStart = getWeekStart();
  return date >= weekStart;
};
