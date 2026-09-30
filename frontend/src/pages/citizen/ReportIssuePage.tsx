import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { DEFAULT_CIVIC_IMAGE_PLACEHOLDER } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useNotification } from '../../context/NotificationContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LocationMapPicker } from '../../components/LocationMapPicker';
import { PriorityBadge } from '../../components/PriorityBadge';
import {
  resolveIssueLocation,
  findDuplicateComplaints,
  isWithinNashikServiceArea,
  requestFreshGpsLocation,
  reverseGeocodeCoordinates
} from '../../services/locationService';
import {
  detectCivicIssue,
  extractVisualFeatures,
  compareImageSimilarity,
  checkAiHealth,
  normalizeDepartment,
  CIVIC_CATEGORIES,
  CivicCategory
} from '../../services/aiVisionService';
import {
  createComplaint,
  uploadComplaintImage,
  generateComplaintNumber,
  saveOfflineDraft,
  clearOfflineDrafts,
  getOfflineDrafts,
  getAllComplaints,
  HttpError,
  AuthError,
  isNetworkError
} from '../../services/complaintService';
import { resolveDepartmentInfo } from '../../services/departmentService';
import { PriorityLevel, AIVisionResult, VisualFeatures, ImageSimilarityResult, ComplaintAngle, ComplaintAnglePhoto } from '../../types/database.types';
import {
  Camera, Upload, Sparkles, AlertTriangle, CheckCircle2, MapPin,
  ArrowRight, ArrowLeft, RefreshCw, ShieldCheck, WifiOff, FileText, X, Edit3, Save, ThumbsUp, Plus, Image as ImageIcon, Eye, ZoomIn
} from 'lucide-react';

interface AngleSlotData {
  file: File | null;
  previewUrl: string;
}

interface AngleConfig {
  angle: ComplaintAngle;
  number: number;
  title: string;
  badge: string;
  subtitle: string;
  recommended?: boolean;
}

const ANGLE_CONFIGS: AngleConfig[] = [
  {
    angle: 'front',
    number: 1,
    title: '1. Front View',
    badge: 'Recommended / Primary',
    subtitle: 'Primary overview of defect and street context',
    recommended: true
  },
  {
    angle: 'left',
    number: 2,
    title: '2. Left View',
    badge: 'Perspective & Depth',
    subtitle: 'Left-side perspective showing depth & footpath'
  },
  {
    angle: 'right',
    number: 3,
    title: '3. Right View',
    badge: 'Traffic & Context',
    subtitle: 'Right-side perspective showing oncoming lane & surroundings'
  },
  {
    angle: 'closeup',
    number: 4,
    title: '4. Close-Up Detail',
    badge: 'Defect Severity',
    subtitle: 'Macro shot of crack depth, pothole crater, or defect severity'
  }
];

export const ReportIssuePage: React.FC = () => {
  const { user } = useAuth();
  const { t, translateCategory, translatePriority, translateDepartment } = useLanguage();
  const { toast } = useNotification();
  const navigate = useNavigate();

  // 4-Angle Photo Evidence State
  const [angleSlots, setAngleSlots] = useState<Record<ComplaintAngle, AngleSlotData>>({
    front: { file: null, previewUrl: '' },
    left: { file: null, previewUrl: '' },
    right: { file: null, previewUrl: '' },
    closeup: { file: null, previewUrl: '' },
  });
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const [analyzingAI, setAnalyzingAI] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AIVisionResult | null>(null);
  const [aiHealth, setAiHealth] = useState<{ reachable: boolean; configured: boolean; model: string } | null>(null);
  const [primaryFeatures, setPrimaryFeatures] = useState<VisualFeatures | null>(null);

  // Form Field States
  const [category, setCategory] = useState<CivicCategory>('Road Damage / Pothole');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [department, setDepartment] = useState<string>('Public Works Department');
  const [isManuallyEdited, setIsManuallyEdited] = useState<boolean>(false);

  // Location States
  const [lat, setLat] = useState<number>(20.0059);
  const [lng, setLng] = useState<number>(73.7898);
  const [locationAccuracy, setLocationAccuracy] = useState<number | undefined>(15);
  const [locationSource, setLocationSource] = useState<'live_gps' | 'exif_gps' | 'manual_pin' | 'geocoded' | 'geocode_failed' | 'unavailable' | 'gps'>('manual_pin');
  const [locationStatusText, setLocationStatusText] = useState<string>('Select defect location on Leaflet map pin');
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);

  // Duplicate Check & UI Modal States
  const [nearbyDuplicates, setNearbyDuplicates] = useState<Array<{ complaint: any; distanceMeters: number }>>([]);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState<boolean>(false);
  const [showLocationPromptModal, setShowLocationPromptModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [draftSavedToast, setDraftSavedToast] = useState<boolean>(false);
  const isSubmittingRef = React.useRef<boolean>(false);
  const cachedComplaintsRef = React.useRef<any[] | null>(null);

  // Initial AI Health & Location Check & Resume Offline Draft if present
  React.useEffect(() => {
    checkAiHealth().then(setAiHealth).catch(() => setAiHealth({ reachable: false, configured: false, model: 'Offline' }));
    requestFreshLocation(false);

    try {
      const drafts = getOfflineDrafts();
      if (drafts && drafts.length > 0) {
        const latest = drafts[0] as any;
        if (latest) {
          if (latest.category) setCategory(latest.category as CivicCategory);
          if (latest.title) setTitle(latest.title);
          if (latest.description) setDescription(latest.description);
          if (latest.priority) setPriority(latest.priority);
          if (latest.department) setDepartment(latest.department);
          if (latest.lat != null && !isNaN(Number(latest.lat))) setLat(Number(latest.lat));
          if (latest.lng != null && !isNaN(Number(latest.lng))) setLng(Number(latest.lng));
          if (latest.locationAddress) setLocationAddress(latest.locationAddress);
          if (latest.angleDrafts) {
            setAngleSlots({
              front: { file: null, previewUrl: latest.angleDrafts.front || latest.photoPreviewUrl || '' },
              left: { file: null, previewUrl: latest.angleDrafts.left || '' },
              right: { file: null, previewUrl: latest.angleDrafts.right || '' },
              closeup: { file: null, previewUrl: latest.angleDrafts.closeup || '' },
            });
            if (latest.angleDrafts.front || latest.photoPreviewUrl) {
              setPhotoPreviewUrl(latest.angleDrafts.front || latest.photoPreviewUrl);
            }
          } else if (latest.photoPreviewUrl) {
            setPhotoPreviewUrl(latest.photoPreviewUrl);
            setAngleSlots((prev) => ({
              ...prev,
              front: { file: null, previewUrl: latest.photoPreviewUrl }
            }));
          }
        }
      }
    } catch (e) {}
  }, []);

  // Request Fresh Live GPS Location & Check whether browser/device location is enabled
  const requestFreshLocation = async (isUserAction: boolean = false) => {
    setDetectingLocation(true);

    // Fast-path permission check via navigator.permissions if supported
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      try {
        const permStatus = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        if (permStatus.state === 'denied') {
          setDetectingLocation(false);
          setShowLocationPromptModal(true);
          return false;
        }
      } catch {
        // Fall back directly to requestFreshGpsLocation
      }
    }

    try {
      const gps = await requestFreshGpsLocation();
      if (gps && gps.latitude && gps.longitude) {
        setLat(gps.latitude);
        setLng(gps.longitude);
        setLocationAccuracy(gps.accuracyMeters ? Math.round(gps.accuracyMeters) : 10);
        setLocationSource('live_gps');
        setLocationStatusText(`Verified Live GPS Location (±${gps.accuracyMeters ? Math.round(gps.accuracyMeters) : 10}m accuracy)`);
        setShowLocationPromptModal(false);
        runDuplicateCheck(gps.latitude, gps.longitude);

        const addr = await reverseGeocodeCoordinates(gps.latitude, gps.longitude);
        if (addr) setLocationAddress(addr);
        return true;
      } else {
        setShowLocationPromptModal(true);
        return false;
      }
    } catch (e) {
      console.warn('GPS detection failed:', e);
      setShowLocationPromptModal(true);
      return false;
    } finally {
      setDetectingLocation(false);
    }
  };

  // Handle Capture or Upload for Any of the 4 Image Angles
  const handleAnglePhotoSelect = async (angle: ComplaintAngle, file: File) => {
    const url = URL.createObjectURL(file);
    setAngleSlots((prev) => ({
      ...prev,
      [angle]: { file, previewUrl: url }
    }));

    if (angle === 'front') {
      setSelectedPhotoFile(file);
      setPhotoPreviewUrl(url);
      setPrimaryFeatures(null);
      setAiResult(null);

      // Extract visual features locally
      try {
        const feats = await extractVisualFeatures(file);
        setPrimaryFeatures(feats);
      } catch (e) {
        console.warn('Local visual feature extraction skipped:', e);
      }

      // Run AI Vision & Location Resolution on Front View
      await runAIVisionAndLocation(file, url);
    } else {
      // If Front View hasn't been uploaded yet, set this as primary preview fallback
      if (!angleSlots.front.file && !photoPreviewUrl) {
        setSelectedPhotoFile(file);
        setPhotoPreviewUrl(url);
      }
      if (primaryFeatures) {
        try {
          const angleFeats = await extractVisualFeatures(file);
          const sim = compareImageSimilarity(primaryFeatures, angleFeats, 0);
          if (sim.isExactDuplicate) {
            toast.warning(`Note: The image for ${angle.toUpperCase()} is identical to the Front View.`);
          }
        } catch (e) {}
      }
    }
  };

  const removeAnglePhoto = (angle: ComplaintAngle) => {
    setAngleSlots((prev) => ({
      ...prev,
      [angle]: { file: null, previewUrl: '' }
    }));
    if (angle === 'front') {
      setSelectedPhotoFile(null);
      setPhotoPreviewUrl('');
      setPrimaryFeatures(null);
      setAiResult(null);
    }
  };

  const handlePhotoSelect = (file: File) => handleAnglePhotoSelect('front', file);

  // Run AI Vision Analysis & Location Extraction
  const runAIVisionAndLocation = async (file: File, photoUrlStr: string, isRetry: boolean = false) => {
    setAnalyzingAI(true);

    // Extract EXIF location if available and not set by live GPS
    try {
      const resolvedLoc = await resolveIssueLocation(file, lat, lng);
      if (resolvedLoc.latitude && resolvedLoc.longitude) {
        setLat(resolvedLoc.latitude);
        setLng(resolvedLoc.longitude);
        setLocationSource(resolvedLoc.source);
        setLocationStatusText(
          resolvedLoc.source === 'live_gps'
            ? '✓ Verified Live GPS Device Location'
            : resolvedLoc.source === 'exif_gps'
            ? '📷 Location Extracted from Photo EXIF Metadata'
            : '📍 Location Pin Set Manually'
        );
        runDuplicateCheck(resolvedLoc.latitude, resolvedLoc.longitude);

        const addr = await reverseGeocodeCoordinates(resolvedLoc.latitude, resolvedLoc.longitude);
        if (addr) setLocationAddress(addr);
      }
    } catch (err) {
      console.warn('Location resolution warning:', err);
    }

    try {
      const res = await detectCivicIssue(file, isRetry);
      setAiResult(res);
      setPrimaryFeatures(res.visual_features || null);

      if (res.is_available !== false && res.confidence > 0) {
        if (res.category) setCategory(res.category as CivicCategory);
        if (res.title) setTitle(res.title);
        if (res.description) setDescription(res.description);
        if (res.priority) setPriority(res.priority);
        if (res.department) {
          setDepartment(normalizeDepartment(res.department, res.category));
        }
      }
    } catch (err) {
      console.error('AI Vision Error:', err);
    } finally {
      setAnalyzingAI(false);
    }
  };

  const runDuplicateCheck = async (checkLat: number, checkLng: number) => {
    try {
      let existing = cachedComplaintsRef.current;
      if (!existing || existing.length === 0) {
        existing = await getAllComplaints();
        cachedComplaintsRef.current = existing;
      }
      const dups = findDuplicateComplaints(checkLat, checkLng, existing, 100);
      setNearbyDuplicates(dups);
    } catch {
      setNearbyDuplicates([]);
    }
  };

  const handleSaveDraft = () => {
    saveOfflineDraft({
      category,
      title,
      description,
      priority,
      department,
      lat,
      lng,
      locationAddress,
      photoPreviewUrl: angleSlots.front.previewUrl || photoPreviewUrl,
      angleDrafts: {
        front: angleSlots.front.previewUrl,
        left: angleSlots.left.previewUrl,
        right: angleSlots.right.previewUrl,
        closeup: angleSlots.closeup.previewUrl,
      }
    } as any);
    setDraftSavedToast(true);
    setTimeout(() => setDraftSavedToast(false), 3000);
  };

  // Final Complaint Submission
  const handleFinalSubmit = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // Synchronous immediate guard against double-clicks and concurrent executions
    if (isSubmittingRef.current || submitting) {
      return;
    }
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const complaintNumber = generateComplaintNumber();

      const hasAnyPhoto = Boolean(
        angleSlots.front.previewUrl ||
        angleSlots.left.previewUrl ||
        angleSlots.right.previewUrl ||
        angleSlots.closeup.previewUrl ||
        photoPreviewUrl
      );

      if (!hasAnyPhoto) {
        toast.warning('Please capture or upload at least one photo (Front View recommended).');
        isSubmittingRef.current = false;
        setSubmitting(false);
        return;
      }

      // Upload all available angle files
      const uploadedUrls: Record<ComplaintAngle, string> = {
        front: '',
        left: '',
        right: '',
        closeup: ''
      };

      const angles: ComplaintAngle[] = ['front', 'left', 'right', 'closeup'];
      for (const ang of angles) {
        const slot = angleSlots[ang];
        if (slot.file) {
          try {
            uploadedUrls[ang] = await uploadComplaintImage(slot.file);
          } catch (uploadErr) {
            console.warn(`Upload failed for ${ang}:`, uploadErr);
          }
        }
        // If upload failed or not available, fallback to permanent base64 data URL (NEVER a temporary blob: URL)
        if (!uploadedUrls[ang] && slot.file) {
          try {
            uploadedUrls[ang] = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string) || DEFAULT_CIVIC_IMAGE_PLACEHOLDER);
              reader.onerror = () => resolve(DEFAULT_CIVIC_IMAGE_PLACEHOLDER);
              reader.readAsDataURL(slot.file!);
            });
          } catch {
            uploadedUrls[ang] = DEFAULT_CIVIC_IMAGE_PLACEHOLDER;
          }
        } else if (!uploadedUrls[ang] && slot.previewUrl && !slot.previewUrl.startsWith('blob:')) {
          uploadedUrls[ang] = slot.previewUrl;
        }
      }

      // Determine primary URL (Front View, or first available angle)
      const primaryUrl = uploadedUrls.front || uploadedUrls.left || uploadedUrls.right || uploadedUrls.closeup || photoPreviewUrl || DEFAULT_CIVIC_IMAGE_PLACEHOLDER;

      const anglePhotos: ComplaintAnglePhoto[] = [
        uploadedUrls.front ? { angle: 'front' as ComplaintAngle, label: 'Front View', url: uploadedUrls.front } : null,
        uploadedUrls.left ? { angle: 'left' as ComplaintAngle, label: 'Left View', url: uploadedUrls.left } : null,
        uploadedUrls.right ? { angle: 'right' as ComplaintAngle, label: 'Right View', url: uploadedUrls.right } : null,
        uploadedUrls.closeup ? { angle: 'closeup' as ComplaintAngle, label: 'Close-up Detail', url: uploadedUrls.closeup } : null,
      ].filter(Boolean) as ComplaintAnglePhoto[];

      const additionalUrls = [
        uploadedUrls.left,
        uploadedUrls.right,
        uploadedUrls.closeup
      ].filter(Boolean);

      const resolvedDept = resolveDepartmentInfo(undefined, department, category);

      const newComplaintData = {
        complaint_number: complaintNumber,
        citizen_id: user?.id || '',
        photo_before_url: primaryUrl,
        photo_front_url: uploadedUrls.front || primaryUrl,
        photo_left_url: uploadedUrls.left || '',
        photo_right_url: uploadedUrls.right || '',
        photo_closeup_url: uploadedUrls.closeup || '',
        angle_photos: anglePhotos,
        additional_photos: additionalUrls,
        ai_vision_metadata: (aiResult && aiResult.confidence > 0) ? {
          category: aiResult.category,
          confidence: aiResult.confidence,
          confidence_level: aiResult.confidence_level,
          detected_objects: aiResult.detected_objects,
          analysis_time_ms: aiResult.analysis_time_ms,
          angles_count: anglePhotos.length
        } : undefined,
        category,
        title: title || `${category} Issue Reported`,
        description: description || `Civic issue reported via NAGARSETU at ${locationAddress}`,
        priority,
        status: (aiResult && aiResult.confidence < 0.80) ? ('NEEDS_VERIFICATION' as const) : ('Submitted' as const),
        department_id: resolvedDept.id,
        department_name: resolvedDept.fullName,
        latitude: lat,
        longitude: lng,
        location_source: locationSource,
        location_address: locationAddress,
        ai_category: aiResult?.category || category,
        ai_specific_issue: aiResult?.issue_type || category,
        ai_confidence: aiResult?.confidence ?? 0.0,
        ai_severity: aiResult?.priority || priority,
        ai_urgency: aiResult?.priority || priority,
        ai_evidence: aiResult?.description || description,
        ai_model: aiResult?.mode || 'gemini-3.6-flash',
        ai_analyzed_at: new Date().toISOString(),
        needs_manual_verification: !aiResult || aiResult.confidence < 0.80 || aiResult.is_available === false
      };

      const created = await createComplaint(newComplaintData);
      clearOfflineDrafts();
      setShowReviewModal(false);
      // Keep isSubmittingRef.current = true to lock against any duplicate submissions during redirection
      navigate('/citizen/success', { state: { complaint: created } });
    } catch (err: any) {
      console.error('Complaint submission error:', err);
      // Re-enable submission only when submission genuinely fails
      isSubmittingRef.current = false;
      setSubmitting(false);

      if (isNetworkError(err)) {
        handleSaveDraft();
        toast.info('Network issue detected. Complaint saved to offline drafts on your device.');
      } else if (err instanceof AuthError || err.isAuthError || err.status === 401 || err.status === 403) {
        toast.error(err.message || 'Authentication required. Please log in again.');
      } else if (err instanceof HttpError || err.isHttpError || err.status) {
        if (err.status === 429) {
          toast.error(err.message || 'Action rate limit exceeded. Please slow down your requests and try again in a few moments.');
        } else {
          const detailStr = err.data?.details && Array.isArray(err.data.details) ? ` (${err.data.details.join(', ')})` : '';
          toast.error(`${err.message || 'Server error processing complaint.'}${detailStr}`);
        }
      } else {
        toast.error(err.message || 'Failed to submit complaint. Please verify your details.');
      }
    }
  };

  return (
    <DashboardLayout title={t('reportComplaint')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6 font-sans">
        
        {/* HEADER BAR */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Link to="/citizen/portal" className="text-xs font-bold text-emerald-700 hover:underline flex items-center space-x-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('backToDashboard')}</span>
              </Link>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
              {t('reportComplaint')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              {t('reportIssueSubtitle')}
            </p>
          </div>

          <div className={`flex items-center space-x-2 text-xs font-mono font-bold px-3.5 py-2 rounded-full border ${
            aiHealth?.reachable
              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
              : 'text-amber-800 bg-amber-50 border-amber-200'
          }`}>
            <Sparkles className={`w-4 h-4 ${aiHealth?.reachable ? 'text-emerald-600 animate-pulse' : 'text-amber-600'}`} />
            <span>
              {aiHealth?.reachable
                ? `🟢 Gemini Vision Active (${aiHealth.model})`
                : aiHealth?.configured
                ? '🟡 AI Service Quota Limit (Manual Fallback Ready)'
                : '🔴 AI Key Not Configured'}
            </span>
          </div>
        </div>

        {/* DRAFT SAVED TOAST */}
        {draftSavedToast && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center space-x-2 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{t('draftSavedSuccess')}</span>
          </div>
        )}

        {/* MAIN DESKTOP 50/50 SPLIT LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT 50% PANEL: IMAGE & AI ANALYSIS & LOCATION BADGE */}
          <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6 lg:sticky lg:top-20">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-gray-900 font-outfit uppercase tracking-wider flex items-center space-x-2">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span>Complaint Evidence Photos (4 Angles)</span>
                </h2>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Capture up to 4 angles for swift municipal verification. Front View is recommended as primary.
                </p>
              </div>
              <span className={`text-[11px] font-mono font-extrabold px-2.5 py-1 rounded-full border ${
                Object.values(angleSlots).filter((s) => Boolean(s.previewUrl)).length > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-gray-100 text-gray-600 border-gray-200'
              }`}>
                {Object.values(angleSlots).filter((s) => Boolean(s.previewUrl)).length} / 4 Added
              </span>
            </div>

            {/* 4-ANGLE EVIDENCE SLOTS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {ANGLE_CONFIGS.map((cfg) => {
                const slot = angleSlots[cfg.angle];
                const isFront = cfg.angle === 'front';
                const hasImage = Boolean(slot.previewUrl);

                return (
                  <div
                    key={cfg.angle}
                    className={`rounded-2xl border p-3.5 flex flex-col justify-between transition-all ${
                      hasImage
                        ? 'bg-white border-emerald-300 shadow-xs ring-1 ring-emerald-100'
                        : isFront
                        ? 'bg-emerald-50/40 border-dashed border-emerald-300'
                        : 'bg-gray-50/70 border-dashed border-gray-300'
                    }`}
                  >
                    {/* Angle Card Header */}
                    <div className="flex items-start justify-between gap-1 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-gray-900 font-outfit">
                            {cfg.title}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                            isFront
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {cfg.badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 leading-tight mt-0.5">
                          {cfg.subtitle}
                        </p>
                      </div>

                      {hasImage && (
                        <span className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">
                          ✓ Saved
                        </span>
                      )}
                    </div>

                    {/* Angle Slot Body: Preview or Capture Controls */}
                    {hasImage ? (
                      <div className="space-y-2 mt-auto">
                        <div
                          className="relative aspect-4/3 rounded-xl overflow-hidden border border-gray-200 bg-gray-100 group cursor-pointer"
                          onClick={() => setZoomImageUrl(slot.previewUrl)}
                          title="Click to view larger"
                        >
                          <img
                            src={slot.previewUrl}
                            alt={cfg.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <ZoomIn className="w-5 h-5 drop-shadow" />
                          </div>
                          {isFront && analyzingAI && (
                            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white text-[10px] font-bold space-y-1">
                              <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
                              <span>AI Analyzing...</span>
                            </div>
                          )}
                        </div>

                        {/* Action buttons: Retake / Replace / Remove */}
                        <div className="flex items-center space-x-1.5 pt-1">
                          <label
                            htmlFor={`citizen-angle-camera-${cfg.angle}`}
                            className="flex-1 py-1.5 px-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-[11px] text-center border border-gray-300 cursor-pointer min-h-[36px] flex items-center justify-center space-x-1"
                            title="Retake photo using camera"
                          >
                            <Camera className="w-3 h-3 text-emerald-600" />
                            <span>Retake</span>
                          </label>

                          <label
                            htmlFor={`citizen-angle-upload-${cfg.angle}`}
                            className="py-1.5 px-2.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-[11px] text-center border border-gray-300 cursor-pointer min-h-[36px] flex items-center justify-center"
                            title="Replace with file from device"
                          >
                            <Upload className="w-3 h-3 text-blue-600" />
                          </label>

                          <button
                            type="button"
                            onClick={() => removeAnglePhoto(cfg.angle)}
                            className="py-1.5 px-2.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] border border-rose-200 min-h-[36px] flex items-center justify-center"
                            title="Remove this photo"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 py-3 mt-auto">
                        <div className="w-10 h-10 rounded-xl bg-white text-emerald-600 flex items-center justify-center mx-auto border border-gray-200 shadow-2xs">
                          <Camera className="w-5 h-5 text-gray-500" />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <label
                            htmlFor={`citizen-angle-camera-${cfg.angle}`}
                            className="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-[11px] text-center cursor-pointer shadow-xs min-h-[44px] flex items-center justify-center space-x-1.5"
                          >
                            <Camera className="w-3.5 h-3.5 shrink-0" />
                            <span>Camera</span>
                          </label>

                          <label
                            htmlFor={`citizen-angle-upload-${cfg.angle}`}
                            className="py-2.5 px-2 rounded-xl bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-800 font-bold text-[11px] text-center border border-gray-300 shadow-2xs cursor-pointer min-h-[44px] flex items-center justify-center space-x-1.5"
                          >
                            <Upload className="w-3.5 h-3.5 shrink-0 text-gray-600" />
                            <span>Upload</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Camera direct input */}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      id={`citizen-angle-camera-${cfg.angle}`}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleAnglePhotoSelect(cfg.angle, e.target.files[0]);
                        }
                      }}
                    />

                    {/* Standard gallery file input */}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/jpg"
                      id={`citizen-angle-upload-${cfg.angle}`}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleAnglePhotoSelect(cfg.angle, e.target.files[0]);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* AI ANALYSIS RESULT CARD */}
            {aiResult && (aiResult.confidence === 0 || aiResult.is_available === false) ? (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-900 font-outfit uppercase tracking-wider flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>{t('aiVisionAnalysis')}</span>
                  </span>
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded border text-amber-800 bg-white border-amber-200">
                    Status: AI Temporarily Unavailable
                  </span>
                </div>

                <p className="text-amber-900 font-medium text-xs">
                  {aiResult.error_message || 'AI Vision temporarily unavailable because the AI service quota has been reached. You can retry or enter the complaint details manually.'}
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  {angleSlots.front.file && (
                    <button
                      type="button"
                      disabled={analyzingAI}
                      onClick={() => {
                        if (angleSlots.front.file && !analyzingAI) runAIVisionAndLocation(angleSlots.front.file, angleSlots.front.previewUrl, true);
                      }}
                      className="w-full sm:w-1/2 py-2.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 font-bold border border-amber-300 flex items-center justify-center space-x-1 min-h-[44px] cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-amber-600 ${analyzingAI ? 'animate-spin' : ''}`} />
                      <span>{analyzingAI ? t('retrying') : t('retryAiAnalysis')}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const titleInput = document.getElementById('complaint-title-input');
                      if (titleInput) titleInput.focus();
                    }}
                    className="w-full sm:w-1/2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center space-x-1 min-h-[44px] cursor-pointer"
                  >
                    <span>{t('continueManually')}</span>
                  </button>
                </div>
              </div>
            ) : aiResult && (
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-300 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-900 font-outfit uppercase tracking-wider flex items-center space-x-1">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>{t('aiVisionAnalysisResult')}</span>
                  </span>

                  <span
                    className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded border ${
                      aiResult.confidence_level === 'High'
                        ? 'text-emerald-800 bg-white border-emerald-200'
                        : aiResult.confidence_level === 'Medium'
                        ? 'text-amber-800 bg-amber-50 border-amber-200'
                        : 'text-rose-800 bg-rose-50 border-rose-200'
                    }`}
                  >
                    {aiResult.confidence_level === 'High' ? '🟢 High Confidence' : aiResult.confidence_level === 'Medium' ? '🟡 Please Verify' : '⚪ Low Confidence'} ({Math.round(aiResult.confidence * 100)}%)
                  </span>
                </div>

                {/* Quality Warning if any */}
                {aiResult.quality_check?.warning && (
                  <div className="p-2.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-medium flex items-center space-x-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>{aiResult.quality_check.warning}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-gray-800 pt-1 font-medium">
                  <div>
                    <span className="text-gray-500 block text-[10px]">{t('aiDetectedCategory')}</span>
                    <strong className="text-emerald-900 font-outfit text-sm">✓ {translateCategory(aiResult.category)}</strong>
                  </div>
                  <div>
                    <span className="text-gray-500 block text-[10px]">{t('recommendedDepartment')}</span>
                    <strong className="text-gray-900 text-xs truncate block">{translateDepartment(aiResult.department)}</strong>
                  </div>
                </div>

                {aiResult.detected_objects && aiResult.detected_objects.length > 0 && (
                  <div className="pt-1 border-t border-emerald-200/60 flex flex-wrap gap-1 items-center">
                    <span className="text-[10px] text-gray-500 mr-1">{t('detectedFeatures')}</span>
                    {aiResult.detected_objects.map((obj) => (
                      <span key={obj} className="px-1.5 py-0.5 bg-white rounded border border-emerald-200 text-[10px] font-mono text-emerald-800">
                        #{obj}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AUTOMATIC & INTERACTIVE LOCATION CARD WITH EMBEDDED MAP */}
            <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm space-y-3 font-sans">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5 text-rose-500" />
                  <span className="font-extrabold text-gray-900 font-outfit text-sm">📍 {t('complaintLocation')}</span>
                </div>

                <button
                  type="button"
                  onClick={() => requestFreshLocation(true)}
                  disabled={detectingLocation}
                  className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs border border-emerald-200 flex items-center space-x-1 min-h-[36px] cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${detectingLocation ? 'animate-spin' : ''}`} />
                  <span>{detectingLocation ? t('detecting') : t('detectMyLocation')}</span>
                </button>
              </div>

              {/* LOCATION STATUS & ACCURACY BADGE */}
              <div className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                locationSource === 'live_gps'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                  : 'bg-blue-50 text-blue-900 border-blue-200'
              }`}>
                <span className="flex items-center space-x-1.5">
                  {detectingLocation ? (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  ) : locationSource === 'live_gps' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  )}
                  <span>{locationStatusText}</span>
                </span>

                {locationAccuracy && (
                  <span className="font-mono text-[10px] font-extrabold bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700">
                    ±{locationAccuracy}m
                  </span>
                )}
              </div>

              {/* EMBEDDED MAP PICKER */}
              <div className="rounded-xl overflow-hidden border border-gray-200">
                <LocationMapPicker
                  initialLat={lat}
                  initialLng={lng}
                  accuracyMeters={locationAccuracy}
                  accuracyStatusText={locationSource === 'live_gps' ? '✓ Live GPS' : '📍 Manual Pin'}
                  onLocationSelect={async (newLat, newLng) => {
                    setLat(newLat);
                    setLng(newLng);
                    setLocationSource('manual_pin');
                    setLocationStatusText(`Location pin set to ${newLat.toFixed(4)}, ${newLng.toFixed(4)}`);
                    runDuplicateCheck(newLat, newLng);

                    const addr = await reverseGeocodeCoordinates(newLat, newLng);
                    if (addr) setLocationAddress(addr);
                  }}
                />
              </div>

              {/* ADDRESS & COORDINATES DISPLAY */}
              <div className="p-3 bg-slate-50 rounded-xl border border-gray-200 space-y-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block font-mono">{t('locationAddressLandmark')}</span>
                <input aria-label="location Address"
                  type="text"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  placeholder={t('locationLandmarkPlaceholder')}
                  className="w-full bg-white border border-gray-200 rounded-lg p-2 font-bold text-xs text-gray-900 focus:border-emerald-500"
                />
                <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 pt-0.5">
                  <span>Coordinates: {lat.toFixed(6)}, {lng.toFixed(6)}</span>
                  <span className="font-bold text-emerald-700 uppercase bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                    {locationSource}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT 50% PANEL: COMPLAINT DETAILS FORM & ACTIONS */}
          <div className="lg:col-span-6 bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
            
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h2 className="text-sm font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
                {t('complaintDetailsFormStep')}
              </h2>
              {isManuallyEdited && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  ✓ {t('manuallyEdited')}
                </span>
              )}
            </div>

            {/* FORM FIELDS */}
            <div className="space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-gray-700 mb-1">{t('category')}</label>
                <select aria-label="category"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as CivicCategory);
                    setIsManuallyEdited(true);
                  }}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 focus:border-emerald-500 min-h-[44px]"
                >
                  {CIVIC_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{translateCategory(c)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">{t('complaintTitle')}</label>
                <input aria-label="complaint title input"
                  type="text"
                  id="complaint-title-input"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setIsManuallyEdited(true);
                  }}
                  placeholder={t('enterTitle')}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 focus:border-emerald-500 min-h-[44px]"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">{t('description')}</label>
                <textarea aria-label="description"
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    setIsManuallyEdited(true);
                  }}
                  placeholder={t('enterDescription')}
                  className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-gray-900 focus:border-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">{t('priority')}</label>
                  <select aria-label="priority"
                    value={priority}
                    onChange={(e) => {
                      setPriority(e.target.value as PriorityLevel);
                      setIsManuallyEdited(true);
                    }}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 focus:border-emerald-500 min-h-[44px]"
                  >
                    <option value="Low">{translatePriority('Low')}</option>
                    <option value="Medium">{translatePriority('Medium')}</option>
                    <option value="High">{translatePriority('High')}</option>
                    <option value="Critical">{translatePriority('Critical')}</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">{t('myDepartment')}</label>
                  <select aria-label="department"
                    value={department}
                    onChange={(e) => {
                      setDepartment(e.target.value);
                      setIsManuallyEdited(true);
                    }}
                    className="w-full bg-white border border-gray-300 rounded-xl p-2.5 font-bold text-gray-900 focus:border-emerald-500 min-h-[44px]"
                  >
                    <option value="Public Works Department">{translateDepartment('Public Works Department')}</option>
                    <option value="Sanitation & Waste Management">{translateDepartment('Sanitation & Waste Management')}</option>
                    <option value="Water Supply & Sewerage Board">{translateDepartment('Water Supply & Sewerage Board')}</option>
                    <option value="Drainage & Sewage Department">{translateDepartment('Drainage & Sewage Department')}</option>
                    <option value="Electrical & Street Lighting">{translateDepartment('Electrical & Street Lighting')}</option>
                    <option value="Traffic Management Department">{translateDepartment('Traffic Management Department')}</option>
                    <option value="Maintenance Department">{translateDepartment('Maintenance Department')}</option>
                  </select>
                </div>
              </div>

            </div>

            {/* 100M NEARBY DUPLICATE CHECK */}
            <div className="pt-2 border-t border-gray-100">
              <span className="font-extrabold text-gray-900 font-outfit block text-xs mb-2">
                {t('nearbyComplaintCheck')}
              </span>

              {nearbyDuplicates.length === 0 ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{t('noSimilarComplaintNearby')}</span>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-2 text-xs">
                  <div className="flex items-center space-x-2 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{t('similarComplaintFoundNearby')} ({nearbyDuplicates[0].distanceMeters}m away)</span>
                  </div>
                  <p className="text-amber-800 text-[11px]">{t('existingComplaintReportedNearby')}</p>
                  <div className="flex items-center space-x-2 pt-1">
                    <Link
                      to={`/citizen/complaint/${nearbyDuplicates[0].complaint.id}`}
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 min-h-[44px] flex items-center"
                    >
                      {t('viewExisting')}
                    </Link>
                    <button
                      type="button"
                      onClick={() => toast.success(`Thank you! Your support for complaint ${nearbyDuplicates[0].complaint.complaint_number} has been recorded.`)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 font-bold text-xs hover:bg-amber-100 min-h-[44px]"
                    >
                      {t('supportExisting')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* FORM ACTIONS */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleSaveDraft}
                className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs border border-gray-300 min-h-[44px] flex items-center justify-center space-x-1.5"
              >
                <Save className="w-4 h-4 text-gray-600" />
                <span>{t('saveDraft')}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowReviewModal(true)}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm min-h-[44px] flex items-center justify-center space-x-2 transition-all"
              >
                <span>{t('reviewComplaint')} ({Object.values(angleSlots).filter((s) => Boolean(s.previewUrl)).length} Photos)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* TURN ON YOUR LOCATION POPUP MODAL */}
      {showLocationPromptModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="turn-on-location-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs font-sans"
        >
          <div className="max-w-md w-full bg-white rounded-2xl p-6 sm:p-7 border border-gray-200 shadow-2xl space-y-5 text-center my-auto animate-in fade-in zoom-in-95 duration-200">
            {/* Location Icon Badge */}
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
              <MapPin className="w-8 h-8" />
            </div>

            {/* Title & Description */}
            <div className="space-y-2">
              <h3 id="turn-on-location-title" className="text-xl font-extrabold text-gray-900 font-outfit">
                Turn On Your Location
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Please turn on your device location to report a complaint. Location is required to accurately identify the complaint location.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                id="btn-turn-on-location"
                onClick={() => requestFreshLocation(true)}
                disabled={detectingLocation}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-xs uppercase tracking-wider shadow-md hover:shadow-lg flex items-center justify-center space-x-2 min-h-[48px] cursor-pointer transition-all disabled:opacity-60"
              >
                {detectingLocation ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white mr-1.5" />
                    <span>Detecting Location...</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4 mr-1.5" />
                    <span>Turn On Location</span>
                  </>
                )}
              </button>

              <button
                type="button"
                id="btn-cancel-location"
                onClick={() => setShowLocationPromptModal(false)}
                className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 font-bold text-xs uppercase tracking-wider min-h-[44px] cursor-pointer transition-all"
              >
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT LOCATION MAP PICKER MODAL */}
      {showLocationPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans overflow-y-auto">
          <div className="max-w-xl w-full bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-md space-y-4 max-h-[90vh] my-auto overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">Adjust Site Location Pin</h3>
              <button onClick={() => setShowLocationPickerModal(false)} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">✕</button>
            </div>

            <div className="h-64 rounded-xl overflow-hidden border border-gray-200">
              <LocationMapPicker
                initialLat={lat}
                initialLng={lng}
                onLocationSelect={(newLat, newLng) => {
                  setLat(newLat);
                  setLng(newLng);
                  setLocationSource('manual_pin');
                  runDuplicateCheck(newLat, newLng);
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">{t('locationAddressLandmark')}</label>
              <input aria-label="location Address"
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl p-2.5 text-xs font-bold text-gray-900 min-h-[44px]"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowLocationPickerModal(false)}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold text-xs uppercase min-h-[44px]"
              >
                Confirm Location Pin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FINAL REVIEW & SUBMIT MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans overflow-y-auto">
          <div className="max-w-lg w-full bg-white rounded-xl p-4 sm:p-6 border border-gray-200 shadow-md space-y-4 max-h-[90vh] my-auto overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">{t('reviewBeforeSubmission')}</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">✕</button>
            </div>

            {/* 4-Angle Photo Preview Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-1">
              {ANGLE_CONFIGS.map((cfg) => {
                const url = angleSlots[cfg.angle].previewUrl;
                if (!url) return null;
                return (
                  <div key={cfg.angle} className="relative rounded-xl overflow-hidden border border-gray-200 aspect-4/3 bg-gray-100">
                    <img src={url} alt={cfg.title} className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-1 bg-gray-900/80 text-white text-[9px] px-1.5 py-0.5 rounded font-mono font-bold">
                      {cfg.title}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800 font-outfit">{t('category')}: {translateCategory(category)}</span>
                <PriorityBadge priority={priority} />
              </div>

              <div>
                <strong className="block text-gray-900 font-outfit text-sm">{title || `${translateCategory(category)} Issue`}</strong>
                <p className="text-gray-600 text-[11px] mt-0.5">{description || 'No description provided.'}</p>
              </div>

              <div className="pt-2 border-t border-gray-200 flex flex-wrap justify-between text-gray-500 text-[11px]">
                <span>Dept: {translateDepartment(department)}</span>
                <span>Address: {locationAddress}</span>
              </div>

              {aiResult && (
                <div className="pt-1.5 border-t border-gray-200 text-[10px] text-emerald-700 font-mono flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>AI Confidence: {Math.round(aiResult.confidence * 100)}% ({aiResult.confidence_level})</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs min-h-[44px]"
              >
                {t('editForm')}
              </button>

              <button
                type="button"
                id="btn-submit-complaint-final"
                onClick={handleFinalSubmit}
                disabled={submitting || isSubmittingRef.current}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase min-h-[44px] flex items-center space-x-1.5 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-all"
              >
                {submitting || isSubmittingRef.current ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>{t('submitting')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{t('submitComplaint')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-SCREEN ZOOM IMAGE PREVIEW MODAL */}
      {zoomImageUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-xs"
          onClick={() => setZoomImageUrl(null)}
        >
          <div className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setZoomImageUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-gray-900/70 text-white hover:bg-gray-900 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={zoomImageUrl} alt="Full Angle Preview" className="w-full max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};
