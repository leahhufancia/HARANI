import { mutateData } from './storageService.js';
import { requireProfile } from './dataRules.js';

export const getUserNotifications = (data, userId) => data.notifications.filter((item) => item.user_id === userId).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));

export async function markAsRead(id, userId) {
  return mutateData((data) => {
    requireProfile(data, userId);
    const notification = data.notifications.find((item) => item.id === id && item.user_id === userId);
    if (!notification) throw new Error('This notification was not found for your account.');
    notification.is_read = true;
  });
}

export async function markAllAsRead(userId) {
  return mutateData((data) => {
    requireProfile(data, userId);
    data.notifications.filter((item) => item.user_id === userId).forEach((item) => { item.is_read = true; });
  });
}
