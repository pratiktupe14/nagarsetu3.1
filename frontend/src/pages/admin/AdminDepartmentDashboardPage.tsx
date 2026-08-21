import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { DashboardLayout } from '../../components/DashboardLayout';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { getAllComplaints } from '../../services/complaintService';
import {
  getMunicipalDepartments, getAllServiceStaffRecords,
  MunicipalDepartmentRecord, ServiceStaffMemberRecord
} from '../../services/adminService';
import { getStoredProfiles } from '../../services/profileService';
import { Complaint, UserProfile } from '../../types/database.types';
import { useRealtimeComplaints } from '../../hooks/useRealtimeComplaints';
import { useLanguage } from '../../context/LanguageContext';
import {
  Building2, Users, FileText, CheckCircle2, AlertTriangle, RefreshCw,
  Search, Eye, Clock, Activity, Wrench, Trash2, Droplets, Waves, Zap,
  Compass, MapPin, ExternalLink, Sliders, TrendingUp, Award, Layers,
  FileSpreadsheet, ArrowRight, ShieldCheck, ChevronRight
} from 'lucide-react';

// Fix standard Leaflet marker icon asset issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom DivIcon generator for priority-based map markers
const createCustomMapMarkerIcon = (priority: string) => {
  let bgColor = '#059669'; // Emerald Low
  let pulseColor = '#10b981';

  if (priority === 'Critical') {
    bgColor = '#e11d48'; // Rose Critical
    pulseColor = '#f43f5e';
  } else if (priority === 'High') {
    bgColor = '#ea580c'; // Orange High
    pulseColor = '#fb923c';
  } else if (priority === 'Medium') {
    bgColor = '#d97706'; // Amber Medium
    pulseColor = '#f59e0b';
  }

  const svgHtml = `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; width: 32px; height: 32px; background-color: ${pulseColor}; opacity: 0.35; border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
      <div style="width: 24px; height: 24px; background-color: ${bgColor}; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
        <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-leaflet-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16]
  });
};

const SIX_MUNICIPAL_DEPARTMENTS = [
  { id: 'all', name: 'All Municipal Departments', code: 'ALL', icon: Building2 },
  { id: 'dept-pwd-001', name: 'Roads & Public Works (PWD)', code: 'PWD', icon: Wrench },
  { id: 'dept-san-001', name: 'Sanitation & Waste Management', code: 'SAN', icon: Trash2 },
  { id: 'dept-wtr-001', name: 'Water Supply & Sewerage Board', code: 'WTR', icon: Droplets },
  { id: 'dept-drn-001', name: 'Drainage & Sewage Department', code: 'DRN', icon: Waves },
  { id: 'dept-ele-001', name: 'Electrical & Street Lighting Dept', code: 'ELE', icon: Zap },
  { id: 'dept-trf-001', name: 'Traffic Management Dept', code: 'TRF', icon: Activity }
];

export const AdminDepartmentDashboardPage: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [selectedDeptId, setSelectedDeptId] = useState<string>('all');
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [staffMembers, setStaffMembers] = useState<ServiceStaffMemberRecord[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Map layer filter
  const [mapLayerTab, setMapLayerTab] = useState<'All' | 'Active Tasks' | 'Overdue' | 'Critical' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Load Real Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const compList = await getAllComplaints();
      setComplaints(compList);

      const staff = getAllServiceStaffRecords();
      setStaffMembers(staff);

      const profs = getStoredProfiles();
      setProfiles(profs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeComplaints(useCallback(() => {
    loadData();
  }, [loadData]));

  const now = new Date();

  // Helper matching complaint to selected department
  const isComplaintMatch = useCallback((c: Complaint, deptId: string) => {
    if (deptId === 'all') return true;
    const targetDept = SIX_MUNICIPAL_DEPARTMENTS.find((d) => d.id === deptId);
    if (!targetDept) return true;

    if (c.department_id === targetDept.id) return true;
    const cDept = (c.department_name || '').toLowerCase();
    const tCode = targetDept.code.toLowerCase();
    const tName = targetDept.name.split('(')[0].trim().toLowerCase();

    return cDept.includes(tCode) || cDept.includes(tName);
  }, []);

  // Filtered Complaints for Selected Department
  const deptComplaints = useMemo(() => {
    return complaints.filter((c) => isComplaintMatch(c, selectedDeptId));
  }, [complaints, selectedDeptId, isComplaintMatch]);

  // Selected Department Meta Information
  const currentDeptMeta = useMemo(() => {
    return SIX_MUNICIPAL_DEPARTMENTS.find((d) => d.id === selectedDeptId) || SIX_MUNICIPAL_DEPARTMENTS[0];
  }, [selectedDeptId]);

  // Find Department Head Name for Selected Department
  const currentDeptHeadName = useMemo(() => {
    if (selectedDeptId === 'all') return 'City Executive Leadership';
    const headProf = profiles.find((p) => p.role === 'department_head' && (p.department_id === selectedDeptId || (p.department_name && p.department_name.toLowerCase().includes(currentDeptMeta.code.toLowerCase()))));
    return headProf?.full_name || (currentDeptMeta.code === 'PWD' ? 'Anil Kulkarni' : currentDeptMeta.code === 'SAN' ? 'Dr. Anjali Patil' : currentDeptMeta.code === 'WTR' ? 'Er. Vikram Deshmukh' : 'Department Officer');
  }, [profiles, selectedDeptId, currentDeptMeta]);

  // Calculate Real 10 Performance Metrics from Real Database Data
  const metrics = useMemo(() => {
    const total = deptComplaints.length;
    const newComplaints = deptComplaints.filter((c) => c.status === 'Submitted' || c.status === 'Verified').length;
    const pending = deptComplaints.filter((c) => c.status === 'Approved' || c.status === 'Department Assigned').length;
    const assigned = deptComplaints.filter((c) => c.status === 'Staff Assigned').length;
    const inProgress = deptComplaints.filter((c) => c.status === 'In Progress' || c.status === 'Accepted' || c.status === 'On the Way').length;
    const pendingReview = deptComplaints.filter((c) => c.status === 'Resolution Submitted').length;
    
    const overdue = deptComplaints.filter((c) => {
      if (c.status === 'Resolved' || c.status === 'Rejected' || !c.sla_deadline) return false;
      return new Date(c.sla_deadline) < now;
    }).length;

    const completed = deptComplaints.filter((c) => c.status === 'Resolution Submitted' || c.status === 'Resolved').length;
    const resolved = deptComplaints.filter((c) => c.status === 'Resolved').length;
    const critical = deptComplaints.filter((c) => c.priority === 'Critical' && c.status !== 'Resolved' && c.status !== 'Rejected').length;

    const resolutionRate = total > 0 ? `${((resolved / total) * 100).toFixed(1)}%` : '0.0%';

    return { total, newComplaints, pending, assigned, inProgress, pendingReview, overdue, completed, resolved, critical, resolutionRate };
  }, [deptComplaints, now]);

  // Six Department Comparison Cards (Real Database Data)
  const sixDepartmentComparisonCards = useMemo(() => {
    return SIX_MUNICIPAL_DEPARTMENTS.filter((d) => d.id !== 'all').map((dept) => {
      const list = complaints.filter((c) => isComplaintMatch(c, dept.id));
      const total = list.length;
      const inProgress = list.filter((c) => c.status === 'In Progress' || c.status === 'Accepted' || c.status === 'On the Way' || c.status === 'Staff Assigned').length;
      const overdue = list.filter((c) => c.status !== 'Resolved' && c.status !== 'Rejected' && c.sla_deadline && new Date(c.sla_deadline) < now).length;
      const resolved = list.filter((c) => c.status === 'Resolved').length;
      const resolutionRate = total > 0 ? `${((resolved / total) * 100).toFixed(0)}%` : '100%';
      const headProf = profiles.find((p) => p.role === 'department_head' && (p.department_id === dept.id || (p.department_name && p.department_name.toLowerCase().includes(dept.code.toLowerCase()))));
      const headName = headProf?.full_name || (dept.code === 'PWD' ? 'Anil Kulkarni' : dept.code === 'SAN' ? 'Dr. Anjali Patil' : dept.code === 'WTR' ? 'Er. Vikram Deshmukh' : 'Department Officer');

      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        icon: dept.icon,
        headName,
        total,
        inProgress,
        overdue,
        resolved,
        resolutionRate
      };
    });
  }, [complaints, profiles, isComplaintMatch, now]);

  // Filter map plottable complaints
  const mapPlottableComplaints = useMemo(() => {
    return deptComplaints.filter((c) => {
      if (typeof c.latitude !== 'number' || typeof c.longitude !== 'number' || isNaN(c.latitude) || isNaN(c.longitude) || c.latitude === 0 || c.longitude === 0) return false;
      if (mapLayerTab === 'Active Tasks' && c.status !== 'In Progress' && c.status !== 'Accepted' && c.status !== 'On the Way') return false;
      if (mapLayerTab === 'Overdue' && (c.status === 'Resolved' || !c.sla_deadline || new Date(c.sla_deadline) >= now)) return false;
      if (mapLayerTab === 'Critical' && c.priority !== 'Critical') return false;
      if (mapLayerTab === 'Completed' && c.status !== 'Resolved') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = c.complaint_number.toLowerCase().includes(q);
        const titleMatch = c.title.toLowerCase().includes(q);
        const locMatch = (c.location_address || '').toLowerCase().includes(q);
        if (!numMatch && !titleMatch && !locMatch) return false;
      }

      return true;
    });
  }, [deptComplaints, mapLayerTab, searchQuery, now]);

  return (
    <DashboardLayout title={t('departmentDashboard') || "Department Performance Dashboard"}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto text-gray-900 bg-white min-h-screen font-sans">
        
        {/* HEADER BAR & DEPARTMENT SELECTOR */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-xs shrink-0">
              <currentDeptMeta.icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 font-outfit tracking-tight">
                  {currentDeptMeta.name}
                </h1>
                <span className="font-mono text-[10px] font-extrabold bg-white text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  CITY ADMIN OVERVIEW
                </span>
              </div>
              <p className="text-xs text-gray-600 font-medium mt-1">
                Department Head: <strong className="text-gray-900 font-outfit">{currentDeptHeadName}</strong> • Real-time operational oversight & analytics across Nashik.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {/* DEPARTMENT SELECTOR DROPDOWN */}
            <div className="relative">
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="bg-white border-2 border-emerald-500 rounded-xl px-4 py-2.5 text-xs text-gray-900 font-extrabold shadow-xs focus:outline-none min-h-[42px] font-outfit cursor-pointer"
              >
                {SIX_MUNICIPAL_DEPARTMENTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.id === 'all' ? 'All Departments ▼' : `${d.name} (${d.code})`}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 rounded-xl bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors min-h-[42px]"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 6 MUNICIPAL DEPARTMENT COMPARISON CARDS (ON ALL DEPARTMENTS VIEW) */}
        {selectedDeptId === 'all' && (
          <div className="space-y-3">
            <h2 className="text-sm font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
              Six Municipal Departments Comparison
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sixDepartmentComparisonCards.map((card) => (
                <div
                  key={card.id}
                  onClick={() => setSelectedDeptId(card.id)}
                  className="p-4 bg-white border border-gray-200 hover:border-emerald-500 rounded-2xl shadow-xs transition-all cursor-pointer space-y-3 group"
                >
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <div className="flex items-center space-x-2">
                      <card.icon className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-extrabold text-gray-900 font-outfit text-sm group-hover:text-emerald-700 transition-colors">{card.name}</h3>
                    </div>
                    <span className="font-mono text-[10px] font-extrabold bg-slate-100 text-gray-700 px-2 py-0.5 rounded">{card.code}</span>
                  </div>

                  <div className="text-xs text-gray-600">
                    <span className="text-gray-400 text-[10px] uppercase font-mono block font-bold">Department Head</span>
                    <span className="font-bold text-gray-900">{card.headName}</span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-center font-mono text-xs pt-1 border-t border-gray-100">
                    <div>
                      <span className="text-[9px] text-gray-400 block font-sans">Total</span>
                      <span className="font-bold text-gray-900">{card.total}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 block font-sans">Active</span>
                      <span className="font-bold text-amber-700">{card.inProgress}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 block font-sans">Overdue</span>
                      <span className="font-bold text-rose-700">{card.overdue}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-400 block font-sans">Resolved</span>
                      <span className="font-bold text-emerald-700">{card.resolved}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 10 PERFORMANCE METRIC TILES */}
        <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 border border-gray-200 rounded-2xl divide-x divide-y sm:divide-y-0 divide-gray-200 bg-white shadow-xs overflow-hidden">
          <div className="p-3 text-center space-y-1">
            <span className="text-[9px] font-bold text-gray-500 uppercase block font-outfit">Total</span>
            <span className="text-xl font-extrabold text-gray-900 font-mono block">{metrics.total}</span>
          </div>

          <div className="p-3 text-center space-y-1">
            <span className="text-[9px] font-bold text-gray-500 uppercase block font-outfit">New</span>
            <span className="text-xl font-extrabold text-blue-700 font-mono block">{metrics.newComplaints}</span>
          </div>

          <div className="p-3 text-center space-y-1">
            <span className="text-[9px] font-bold text-gray-500 uppercase block font-outfit">Pending</span>
            <span className="text-xl font-extrabold text-yellow-700 font-mono block">{metrics.pending}</span>
          </div>

          <div className="p-3 text-center space-y-1">
            <span className="text-[9px] font-bold text-gray-500 uppercase block font-outfit">Assigned</span>
            <span className="text-xl font-extrabold text-indigo-700 font-mono block">{metrics.assigned}</span>
          </div>

          <div className="p-3 text-center space-y-1 bg-amber-50/40">
            <span className="text-[9px] font-bold text-amber-800 uppercase block font-outfit">In Progress</span>
            <span className="text-xl font-extrabold text-amber-700 font-mono block">{metrics.inProgress}</span>
          </div>

          <div className="p-3 text-center space-y-1">
            <span className="text-[9px] font-bold text-gray-500 uppercase block font-outfit">Review</span>
            <span className="text-xl font-extrabold text-purple-700 font-mono block">{metrics.pendingReview}</span>
          </div>

          <div className="p-3 text-center space-y-1 bg-rose-50/40">
            <span className="text-[9px] font-bold text-rose-800 uppercase block font-outfit">Overdue</span>
            <span className="text-xl font-extrabold text-rose-700 font-mono block">{metrics.overdue}</span>
          </div>

          <div className="p-3 text-center space-y-1">
            <span className="text-[9px] font-bold text-gray-500 uppercase block font-outfit">Critical</span>
            <span className="text-xl font-extrabold text-rose-900 font-mono block">{metrics.critical}</span>
          </div>

          <div className="p-3 text-center space-y-1 bg-emerald-50/40">
            <span className="text-[9px] font-bold text-emerald-800 uppercase block font-outfit">Resolved</span>
            <span className="text-xl font-extrabold text-emerald-700 font-mono block">{metrics.resolved}</span>
          </div>

          <div className="p-3 text-center space-y-1 bg-slate-50">
            <span className="text-[9px] font-bold text-gray-500 uppercase block font-outfit">SLA Rate</span>
            <span className="text-xl font-extrabold text-emerald-800 font-mono block">{metrics.resolutionRate}</span>
          </div>
        </div>

        {/* DEPARTMENT MAP SECTION */}
        <div className="p-5 bg-slate-50 rounded-2xl border border-gray-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
            <div className="flex items-center space-x-2">
              <Compass className="w-5 h-5 text-emerald-600" />
              <h2 className="text-sm font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
                {currentDeptMeta.name} — Interactive GIS Map
              </h2>
            </div>

            {/* MAP QUICK TABS */}
            <div className="flex items-center space-x-2 font-bold font-outfit text-xs">
              {(['All', 'Active Tasks', 'Overdue', 'Critical', 'Completed'] as const).map((layer) => (
                <button
                  key={layer}
                  onClick={() => setMapLayerTab(layer)}
                  className={`px-3 py-1.5 rounded-xl transition-all ${
                    mapLayerTab === layer
                      ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                      : 'bg-white text-gray-700 border border-gray-200 hover:bg-slate-100'
                  }`}
                >
                  {layer}
                </button>
              ))}
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-gray-200 shadow-xs bg-slate-100 min-h-[450px] h-[500px] z-10">
            <MapContainer
              center={[20.0059, 73.7898]}
              zoom={13}
              style={{ width: '100%', height: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {mapPlottableComplaints.map((comp) => {
                const markerIcon = createCustomMapMarkerIcon(comp.priority);
                return (
                  <Marker key={comp.id} position={[comp.latitude, comp.longitude]} icon={markerIcon}>
                    <Popup>
                      <div className="p-1 space-y-2 text-xs font-sans max-w-xs">
                        <div className="flex items-center justify-between border-b border-gray-200 pb-1">
                          <span className="font-mono font-bold text-emerald-800">{comp.complaint_number}</span>
                          <PriorityBadge priority={comp.priority} />
                        </div>
                        <h4 className="font-extrabold text-gray-900 text-sm font-outfit">{comp.title}</h4>
                        <div className="text-[11px] text-gray-600 space-y-1">
                          <p>Location: <strong>{comp.location_address || 'Nashik'}</strong></p>
                          <p>Staff: <strong>{comp.assigned_staff_name || 'Unassigned'}</strong></p>
                          <p>Head: <strong>{currentDeptHeadName}</strong></p>
                          <StatusBadge status={comp.status} />
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>

        {/* RECENT DEPARTMENT COMPLAINTS TABLE */}
        <div className="p-5 bg-white rounded-2xl border border-gray-200 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3">
            <h2 className="text-sm font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
              {currentDeptMeta.name} — Recent Complaints & Tasks ({deptComplaints.length})
            </h2>

            <Link
              to="/admin/complaints"
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs transition-colors inline-flex items-center space-x-1"
            >
              <span>View All Complaints</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-gray-700 uppercase font-mono text-[10px] font-extrabold">
                  <th className="p-3.5">Complaint ID</th>
                  <th className="p-3.5">Issue Title</th>
                  <th className="p-3.5">Location Address</th>
                  <th className="p-3.5 text-center">Priority</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Assigned Staff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {deptComplaints.slice(0, 8).map((comp) => (
                  <tr key={comp.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-mono text-emerald-800 font-bold">{comp.complaint_number}</td>
                    <td className="p-3.5 font-bold text-gray-900">{comp.title}</td>
                    <td className="p-3.5 text-gray-600">{comp.location_address || 'Nashik'}</td>
                    <td className="p-3.5 text-center"><PriorityBadge priority={comp.priority} /></td>
                    <td className="p-3.5 text-center"><StatusBadge status={comp.status} /></td>
                    <td className="p-3.5 font-semibold text-gray-800">{comp.assigned_staff_name || 'Unassigned'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};
