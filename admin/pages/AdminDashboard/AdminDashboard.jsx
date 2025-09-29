import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/Sidebar/Sidebar";
import DashboardCard from "../../components/DashboardCard/DashboardCard";
import { FaUsers, FaBuilding, FaUserTie, FaUser } from "react-icons/fa";
import "./AdminDashboard.css";
import axios from "axios"; // Import axios for fetching data
import { buildApi } from "../../services/apiConfig.js";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const [totalUsers, setTotalUsers] = useState(0);
  const [landlordsCount, setLandlordsCount] = useState(0);
  const [tenantsCount, setTenantsCount] = useState(0);
  const [totalProperties, setTotalProperties] = useState(0);

  // Fetch data from backend
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const usersRes = await axios.get(buildApi('/admin/total-users'));
        const propertiesRes = await axios.get(buildApi('/admin/total-properties'));

        setTotalUsers(usersRes.data.totalUsers || 0);
        setLandlordsCount(usersRes.data.landlords || 0);
        setTenantsCount(usersRes.data.tenants || 0);
        setTotalProperties(propertiesRes.data.totalProperties || 0);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      }
    };

    fetchDashboardData();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin");
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-body">
        <Sidebar onLogout={handleLogout} />
        <main className="dashboard-content">
          <h1>Admin Dashboard</h1>
          <p>Manage users and properties efficiently.</p>

          <div className="dashboard-cards">
            <div className="card-accent-blue"><DashboardCard title="Total Users" value={totalUsers} icon={<FaUsers />} /></div>
            <div className="card-accent-purple"><DashboardCard title="Landlords" value={landlordsCount} icon={<FaUserTie />} /></div>
            <div className="card-accent-green"><DashboardCard title="Tenants" value={tenantsCount} icon={<FaUser />} /></div>
            <div className="card-accent-yellow"><DashboardCard title="Properties Listed" value={totalProperties} icon={<FaBuilding />} /></div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
