import MapPage from './pages/MapPage/MapPage';
import TenantMessages from './pages/TenantDashboard/Messages/Messages';
import LandlordMessages from './pages/LandlordDashboard/Messages/Messages';
// ...existing code...
export const routes = [
  // ...existing routes...
  {
    path: '/map',
    element: <MapPage />, 
  },
  {
    path: '/tenant/messages',
    element: <TenantMessages currentUserId={localStorage.getItem('user_id') || 'tenant-demo'} />,
  },
  {
    path: '/landlord/messages',
    element: <LandlordMessages currentUserId={localStorage.getItem('user_id') || 'landlord-demo'} />,
  },
];
// ...existing code...
