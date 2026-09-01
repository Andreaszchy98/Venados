import React from 'react';
import { UserProfile } from '../../types';
import { AdminDashboard } from './AdminDashboard';

interface AdminViewProps {
  user: UserProfile;
}

export const AdminView: React.FC<AdminViewProps> = ({ user }) => {
  return (
    <div className="space-y-6">
      <AdminDashboard user={user} />
    </div>
  );
};
