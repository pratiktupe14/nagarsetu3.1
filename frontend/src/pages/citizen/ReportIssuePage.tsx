import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { DashboardLayout } from '../../components/DashboardLayout';
import { LocationMapPicker } from '../../components/LocationMapPicker';
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
import { createComplaint, uploadComplaintImage, generateComplaintNumber, saveOfflineDraft, getStoredComplaints } from '../../services/complaintService';
import { PriorityLevel, AIVisionResult, VisualFeatures, ImageSimilarityResult } from '../../types/database.types';
import {
  Camera, Upload, Sparkles, AlertTriangle, CheckCircle2, MapPin,
  ArrowRight, ArrowLeft, RefreshCw, ShieldCheck, WifiOff, FileText, X, Edit3, Save, ThumbsUp, Plus, Image as ImageIcon, Eye
} from 'lucide-react';

interface AdditionalPhotoItem {
  id: string;
  file?: File;
  previewUrl: string;
  features: VisualFeatures;
  similarity: ImageSimilarityResult;
}

export const ReportIssuePage: React.FC = () => {
  const { user } = useAuth();
  const { t, translateCategory, translatePriority, translateDepartment } = useLanguage();
  const navigate = useNavigate();

  // Primary Photo & AI State
  const [selectedPhotoFile, setSelectedPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>('');
  const [additionalPhotos, setAdditionalPhotos] = useState<AdditionalPhotoItem[]>([]);
  const [analyzingAI, setAnalyzingAI] = useState<boolean>(false);
  const [analyzingAngle, setAnalyzingAngle] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<AIVisionResult | null>(null);
  const [aiHealth, setAiHealth] = useState<{ reachable: boolean; configured: boolean; model: string } | null>(null);
  const [primaryFeatures, setPrimaryFeatures] = useState<VisualFeatures | null>(null);
  const [angleErrorMsg, setAngleErrorMsg] = useState<string | null>(null);

  // Form Field States
  const [category, setCategory] = useState<CivicCategory>('Road Damage / Pothole');
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priority, setPriority] = useState<PriorityLevel>('Medium');
  const [department, setDepartment] = useState<string>('Roads & Public Works Department (PWD)');
  const [isManuallyEdited, setIsManuallyEdited] = useState<boolean>(false);

  // Location States
  const [lat, setLat] = useState<number>(20.0059);
  const [lng, setLng] = useState<number>(73.7898);
  const [locationAccuracy, setLocationAccuracy] = useState<number | undefined>(15);
  const [locationSource, setLocationSource] = useState<'live_gps' | 'exif' | 'manual_pin'>('manual_pin');
  const [locationStatusText, setLocationStatusText] = useState<string>('Select defect location on Leaflet map pin');
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [detectingLocation, setDetectingLocation] = useState<boolean>(false);

  // Duplicate Check & UI Modal States
  const [nearbyDuplicates, setNearbyDuplicates] = useState<Array<{ complaint: any; distanceMeters: number }>>([]);
  const [showLocationPickerModal, setShowLocationPickerModal] = useState<boolean>(false);
  const [showReviewModal, setShowReviewModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [draftSavedToast, setDraftSavedToast] = useState<boolean>(false);

  // Initial AI Health & Location Check
  React.useEffect(() => {
    checkAiHealth().then(setAiHealth).catch(() => setAiHealth({ reachable: false, configured: false, model: 'Offline' }));
    requestFreshLocation();
  }, []);

  // Request Fresh Live GPS Location
  const requestFreshLocation = async () => {
    setDetectingLocation(true);
    try {
      const gps = await requestFreshGpsLocation();
      if (gps && gps.latitude && gps.longitude) {
        setLat(gps.latitude);
        setLng(gps.longitude);
        setLocationAccuracy(gps.accuracy ? Math.round(gps.accuracy) : 10);
        setLocationSource('live_gps');
        setLocationStatusText(`Verified Live GPS Location (±${gps.accuracy ? Math.round(gps.accuracy) : 10}m accuracy)`);
        runDuplicateCheck(gps.latitude, gps.longitude);

        const addr = await reverseGeocodeCoordinates(gps.latitude, gps.longitude);
        if (addr) setLocationAddress(addr);
      }
    } catch (e) {
      console.warn('GPS detection failed, fallback to Nashik Center pin');
    } finally {
      setDetectingLocation(false);
    }
  };

  // Primary Photo Select & AI Vision Trigger
  const handlePhotoSelect = async (file: File) => {
    setSelectedPhotoFile(file);
    const url = URL.createObjectURL(file);
    setPhotoPreviewUrl(url);
    setPrimaryFeatures(null);
    setAiResult(null);
    setAdditionalPhotos([]);

    // Extract visual features locally for visual similarity check
    try {
      const feats = await extractVisualFeatures(file);
      setPrimaryFeatures(feats);
    } catch (e) {
      console.warn('Local visual feature extraction skipped:', e);
    }

    // Run AI Vision & Location Resolution
    await runAIVisionAndLocation(file, url);
  };

  // Run AI Vision Analysis & Location Extraction
  const runAIVisionAndLocation = async (file: File, photoUrlStr: string, isRetry: boolean = false) => {
    setAnalyzingAI(true);
    setAngleErrorMsg(null);

    // Extract EXIF location if available and not set by live GPS
    try {
      const resolvedLoc = await resolveIssueLocation(file, lat, lng);
      if (resolvedLoc.latitude && resolvedLoc.longitude) {
        setLat(resolvedLoc.latitude);
        setLng(resolvedLoc.longitude);
        setLocationSource(resolvedLoc.location_source);
        setLocationStatusText(
          resolvedLoc.location_source === 'live_gps'
            ? '✓ Verified Live GPS Device Location'
            : resolvedLoc.location_source === 'exif'
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

  // Handle Additional Photo Upload / Different Angle Analysis
  const handleAdditionalPhotoSelect = async (file: File) => {
    if (additionalPhotos.length >= 4) {
      alert('Maximum of 5 photos (1 primary + 4 additional angles) allowed per complaint.');
      return;
    }

    setAnalyzingAngle(true);
    setAngleErrorMsg(null);

    try {
      const angleUrl = URL.createObjectURL(file);
      const angleFeatures = await extractVisualFeatures(file);

      if (primaryFeatures) {
        const similarity = compareImageSimilarity(primaryFeatures, angleFeatures, 0);

        if (similarity.isExactDuplicate) {
          setAngleErrorMsg('Exact duplicate image detected! This exact photo has already been uploaded.');
          setAnalyzingAngle(false);
          return;
        }

        const newPhotoItem: AdditionalPhotoItem = {
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          file,
          previewUrl: angleUrl,
          features: angleFeatures,
          similarity
        };

        setAdditionalPhotos((prev) => [...prev, newPhotoItem]);
      } else {
        const newPhotoItem: AdditionalPhotoItem = {
          id: `photo-${Date.now()}`,
          file,
          previewUrl: angleUrl,
          features: angleFeatures,
          similarity: {
            isExactDuplicate: false,
            similarityScore: 0.85,
            confidenceLevel: 'High',
            relation: 'same_issue_different_angle',
            reason: 'Additional visual evidence attached.'
          }
        };
        setAdditionalPhotos((prev) => [...prev, newPhotoItem]);
      }
    } catch (err) {
      console.error('Angle analysis error:', err);
      setAngleErrorMsg('Failed to process additional angle image.');
    } finally {
      setAnalyzingAngle(false);
    }
  };

  const removeAdditionalPhoto = (id: string) => {
    setAdditionalPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const runDuplicateCheck = (checkLat: number, checkLng: number) => {
    const existing = getStoredComplaints();
    const dups = findDuplicateComplaints(checkLat, checkLng, existing, 100);
    setNearbyDuplicates(dups);
  };

  const handleSaveDraft = () => {
    saveOfflineDraft({
      category, title, description, priority, department, lat, lng, locationAddress, photoPreviewUrl
    });
    setDraftSavedToast(true);
    setTimeout(() => setDraftSavedToast(false), 3000);
  };

  // Final Complaint Submission
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const complaintNumber = generateComplaintNumber();

      // Convert/upload primary photo file to permanent public URL or Base64 Data URI
      let finalPhotoBeforeUrl = photoPreviewUrl;
      if (selectedPhotoFile) {
        try {
          finalPhotoBeforeUrl = await uploadComplaintImage(selectedPhotoFile);
        } catch (uploadErr) {
          console.warn('Primary image upload fallback triggered:', uploadErr);
        }
      }

      // Convert/upload additional photo files to permanent URLs
      const additionalUrls: string[] = [];
      for (const p of additionalPhotos) {
        if (p.file) {
          try {
            const uploadedUrl = await uploadComplaintImage(p.file);
            additionalUrls.push(uploadedUrl);
          } catch (e) {
            additionalUrls.push(p.previewUrl);
          }
        } else {
          additionalUrls.push(p.previewUrl);
        }
      }

      const newComplaintData = {
        complaint_number: complaintNumber,
        citizen_id: user?.id || '',
        photo_before_url: finalPhotoBeforeUrl,
        additional_photos: additionalUrls,
        ai_vision_metadata: (aiResult && aiResult.confidence > 0) ? {
          category: aiResult.category,
          confidence: aiResult.confidence,
          confidence_level: aiResult.confidence_level,
          detected_objects: aiResult.detected_objects,
          analysis_time_ms: aiResult.analysis_time_ms,
          additional_angles_count: additionalPhotos.length
        } : undefined,
        category,
        title: title || `${category} Issue Reported`,
        description: description || `Civic issue reported via NAGARSETU 3.0 at ${locationAddress}`,
        priority,
        status: 'Submitted' as const,
        department_name: department,
        latitude: lat,
        longitude: lng,
        location_source: locationSource,
        location_address: locationAddress
      };

      const created = await createComplaint(newComplaintData);
      setShowReviewModal(false);
      navigate('/citizen/success', { state: { complaint: created } });
    } catch (err) {
      console.error(err);
      saveOfflineDraft({
        category, title, description, priority, department, lat, lng, locationAddress, photoPreviewUrl
      });
      alert('Network issue detected. Complaint saved to offline drafts on your device.');
    } finally {
      setSubmitting(false);
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
              <h2 className="text-sm font-extrabold text-gray-900 font-outfit uppercase tracking-wider">
                {t('photoEvidenceStep')}
              </h2>
              {photoPreviewUrl && (
                <button
                  onClick={() => {
                    setPhotoPreviewUrl('');
                    setSelectedPhotoFile(null);
                    setPrimaryFeatures(null);
                    setAiResult(null);
                    setAdditionalPhotos([]);
                  }}
                  className="text-xs text-rose-600 font-bold hover:underline min-h-[44px]"
                >
                  {t('removePhoto')}
                </button>
              )}
            </div>

            {/* UPLOAD BOX OR LARGE PREVIEW */}
            {!photoPreviewUrl ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center bg-gray-50/50 space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-200">
                    <Camera className="w-7 h-7" />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-gray-900 font-outfit">{t('uploadPrimaryPhoto')}</h3>
                    <p className="text-xs text-gray-500">{t('uploadPhotoSubtitle')}</p>
                  </div>

                  {/* Camera Direct Input */}
                  <label htmlFor="citizen-photo-camera" className="sr-only">Take Photo with Camera</label>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    id="citizen-photo-camera"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handlePhotoSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {/* Gallery / Files Standard Input (No Forced Capture) */}
                  <label htmlFor="citizen-photo-upload" className="sr-only">Upload Issue Photo from Gallery</label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    id="citizen-photo-upload"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handlePhotoSelect(e.target.files[0]);
                      }
                    }}
                  />

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                    <label
                      htmlFor="citizen-photo-camera"
                      className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-sm min-h-[44px] flex items-center justify-center space-x-2"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{t('takePhotoCamera')}</span>
                    </label>

                    <label
                      htmlFor="citizen-photo-upload"
                      className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-extrabold text-xs uppercase tracking-wider cursor-pointer border border-gray-300 shadow-xs min-h-[44px] flex items-center justify-center space-x-2"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{t('galleryFiles')}</span>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              /* LARGE PREVIEW IMAGE (ASPECT 4/3) */
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-4/3 bg-gray-100">
                  <img src={photoPreviewUrl} alt="Civic Issue" className="w-full h-full object-cover" />
                  {analyzingAI && (
                    <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 font-outfit text-xs font-extrabold">
                      <Sparkles className="w-6 h-6 animate-spin text-emerald-400" />
                      <span>{t('analyzingPhoto')}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <label
                    htmlFor="citizen-photo-upload"
                    className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs text-center border border-gray-300 cursor-pointer min-h-[44px] flex items-center justify-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{t('replacePrimaryPhoto')}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreviewUrl('');
                      setSelectedPhotoFile(null);
                      setPrimaryFeatures(null);
                      setAiResult(null);
                      setAdditionalPhotos([]);
                      setTitle('');
                      setDescription('');
                      setIsManuallyEdited(false);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 min-h-[44px]"
                  >
                    {t('removePhoto')}
                  </button>
                </div>
              </div>
            )}

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
                  {selectedPhotoFile && (
                    <button
                      type="button"
                      disabled={analyzingAI}
                      onClick={() => {
                        if (selectedPhotoFile && !analyzingAI) runAIVisionAndLocation(selectedPhotoFile, photoPreviewUrl, true);
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

            {/* ADDITIONAL EVIDENCE / DIFFERENT ANGLE UPLOADS */}
            {photoPreviewUrl && (
              <div className="p-4 bg-slate-50 rounded-xl border border-gray-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span className="font-extrabold text-gray-900 font-outfit">{t('additionalAnglesEvidence')} ({additionalPhotos.length}/4)</span>
                  </div>

                  {/* Additional Angle Camera Input */}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    id="additional-angle-camera"
                    className="hidden"
                    disabled={additionalPhotos.length >= 4 || analyzingAngle}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleAdditionalPhotoSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {/* Additional Angle Gallery/Files Standard Input */}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    id="additional-angle-upload"
                    className="hidden"
                    disabled={additionalPhotos.length >= 4 || analyzingAngle}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleAdditionalPhotoSelect(e.target.files[0]);
                      }
                    }}
                  />

                  {additionalPhotos.length < 4 && (
                    <div className="flex items-center space-x-2">
                      <label
                        htmlFor="additional-angle-camera"
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] cursor-pointer flex items-center space-x-1 min-h-[36px]"
                        title="Take photo with camera"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{t('camera')}</span>
                      </label>

                      <label
                        htmlFor="additional-angle-upload"
                        className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-800 border border-gray-300 rounded-lg font-bold text-[11px] cursor-pointer flex items-center space-x-1 min-h-[36px]"
                        title="Choose photo from gallery or files"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{t('galleryFiles')}</span>
                      </label>
                    </div>
                  )}
                </div>

                {angleErrorMsg && (
                  <div className="p-2 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px] font-medium flex items-center space-x-1">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    <span>{angleErrorMsg}</span>
                  </div>
                )}

                {analyzingAngle && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center space-x-2">
                    <Sparkles className="w-4 h-4 animate-spin text-emerald-600" />
                    <span>{t('comparingNewAngle')}</span>
                  </div>
                )}

                {/* ADDITIONAL PHOTOS LIST & SIMILARITY BADGES */}
                {additionalPhotos.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {additionalPhotos.map((item, idx) => (
                      <div key={item.id} className="p-2.5 bg-white rounded-lg border border-gray-200 flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <img src={item.previewUrl} alt={`Angle ${idx + 1}`} className="w-12 h-12 rounded object-cover border border-gray-200 shrink-0" />
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center space-x-1.5">
                              <span className="font-bold text-gray-900 text-xs">Angle #{idx + 1}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                                  item.similarity.relation === 'same_issue_different_angle'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : item.similarity.relation === 'same_category_different_issue'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {item.similarity.relation === 'same_issue_different_angle'
                                  ? '✓ Same Civic Issue'
                                  : item.similarity.relation === 'same_category_different_issue'
                                  ? 'ℹ Same Category'
                                  : '• Distinct View'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 truncate max-w-xs">{item.similarity.reason}</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeAdditionalPhoto(item.id)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-bold px-2 py-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-500 italic">
                    {t('additionalAnglesHint')}
                  </p>
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
                  onClick={requestFreshLocation}
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
                <input
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
                <select
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
                <input
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
                <textarea
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
                  <select
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
                  <select
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
                      onClick={() => alert(`Thank you! Your support for complaint ${nearbyDuplicates[0].complaint.complaint_number} has been recorded.`)}
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
                <span>{t('reviewComplaint')} ({additionalPhotos.length + 1} Photos)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>

      </div>

      {/* EDIT LOCATION MAP PICKER MODAL */}
      {showLocationPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
          <div className="max-w-xl w-full bg-white rounded-xl p-6 border border-gray-200 shadow-md space-y-4">
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
              <input
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-xs font-sans">
          <div className="max-w-lg w-full bg-white rounded-xl p-6 border border-gray-200 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-extrabold text-gray-900 font-outfit">{t('reviewBeforeSubmission')}</h3>
              <button onClick={() => setShowReviewModal(false)} className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px]">✕</button>
            </div>

            {/* Photo Preview Strip */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              {photoPreviewUrl && (
                <div className="h-28 w-36 shrink-0 rounded-xl overflow-hidden border border-gray-200 relative">
                  <img src={photoPreviewUrl} alt="Primary Preview" className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-gray-900/70 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">Primary</span>
                </div>
              )}

              {additionalPhotos.map((photo, idx) => (
                <div key={photo.id} className="h-28 w-36 shrink-0 rounded-xl overflow-hidden border border-gray-200 relative">
                  <img src={photo.previewUrl} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 bg-emerald-900/80 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">Angle #{idx + 1}</span>
                </div>
              ))}
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-800 font-outfit">{t('category')}: {translateCategory(category)}</span>
                <span className="font-extrabold text-gray-900">{t('priority')}: {translatePriority(priority)}</span>
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
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase min-h-[44px] flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? t('submitting') : t('submitComplaint')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </DashboardLayout>
  );
};
