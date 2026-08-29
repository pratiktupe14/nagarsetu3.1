export type SupportedLanguage = 'en' | 'hi' | 'mr';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeLabel: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' }
];

export const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // App & Navigation
    appTitle: "NAGARSETU",
    tagline: "AI-Powered Civic Issue Resolution",
    dashboard: "Dashboard",
    reportComplaint: "Report Complaint",
    myComplaints: "My Complaints",
    nearbyIssues: "Nearby Issues",
    announcements: "Announcements",
    notifications: "Notifications",
    profile: "Profile",
    settings: "Settings",
    civicWorks: "Civic Works",
    logout: "Sign Out",
    login: "Sign In",
    register: "Register",
    welcome: "Welcome",
    home: "Home",
    features: "Features",
    howItWorks: "How It Works",
    getStarted: "Get Started",
    portalSelect: "Select Portal Access",

    // Roles
    roleCitizen: "Citizen",
    roleOfficer: "Municipal Officer",
    roleStaff: "Field Staff",
    roleAdmin: "Administrator",
    roleDeptHead: "Department Head",

    // Landing Page
    landingHeroTitle: "Smart Civic Issue Reporting & Municipal Operations",
    landingHeroSubtitle: "Connecting citizens, city administration, department heads, and field service staff in one unified digital ecosystem.",
    reportIssueNow: "Report Civic Issue Now",
    trackStatusNow: "Track Complaint Status",
    aiVisionFeatureTitle: "AI Vision Classification",
    aiVisionFeatureDesc: "Automatically detects civic defects from photos and routes complaints to the correct department.",
    geoTaggingFeatureTitle: "Precise Geotagging",
    geoTaggingFeatureDesc: "GPS device tracking, photo EXIF verification, and interactive Leaflet map pin-drop.",
    slaTrackingFeatureTitle: "SLA & Task Assignment",
    slaTrackingFeatureDesc: "Department Heads assign tasks to service staff with real-time resolution evidence verification.",
    howItWorksStep1: "1. Citizen Reports Problem",
    howItWorksStep1Desc: "Upload photo, AI classifies defect & pre-fills department.",
    howItWorksStep2: "2. Department Head Assigns",
    howItWorksStep2Desc: "Department Head routes issue to designated field staff.",
    howItWorksStep3: "3. Staff Resolves & Verifies",
    howItWorksStep3Desc: "Staff fixes defect, uploads photo proof & citizen tracks progress.",

    // Auth (Login / Register)
    loginTitle: "Sign In to NAGARSETU",
    loginSubtitle: "Access your role-based municipal dashboard",
    mobileOrEmail: "Mobile Number or Official Email",
    enterMobileOrEmail: "Enter 10-digit mobile or official email",
    password: "Password",
    enterPassword: "Enter your password",
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
    dontHaveAccount: "Don't have an account?",
    registerHere: "Register here",
    registerTitle: "Create Citizen Account",
    registerSubtitle: "Join NAGARSETU to report and track civic issues",
    fullName: "Full Name",
    enterFullName: "Enter your full name",
    mobileNumber: "10-Digit Mobile Number",
    enterMobileNumber: "Enter 10-digit mobile number",
    emailAddress: "Email Address (Optional)",
    enterEmailAddress: "Enter official or personal email",
    confirmPassword: "Confirm Password",
    alreadyHaveAccount: "Already have an account?",
    demoAccounts: "Pre-seeded Demo Login Accounts",

    // Complaint Form & Fields
    complaintTitle: "Complaint Title",
    description: "Description",
    category: "Category",
    location: "Location",
    uploadImage: "Upload Image",
    submitComplaint: "Submit Complaint",
    priority: "Priority",
    selectCategory: "Select Category",
    selectPriority: "Select Priority",
    enterTitle: "Enter a descriptive complaint title",
    enterDescription: "Describe the civic issue in detail",
    analyzingPhoto: "AI Analyzing Photo & Extracting Location...",
    aiDetectedCategory: "Detected Category",
    aiTitle: "Auto-Generated Title",
    aiDescription: "Auto-Generated Description",
    locationSource: "Location Verification",
    locationLiveGps: "Live Device GPS (High Trust)",
    locationExifGps: "Photo EXIF Metadata GPS",
    locationManualPin: "Manual Map Pin Drop",
    locationConflictTitle: "GPS Location Conflict (>500m)",
    locationConflictMsg: "Photo metadata location differs from current device GPS. Please choose correct location:",
    useLiveGps: "Use Current Location",
    useExifGps: "Use Photo Metadata Location",
    manualPinRequiredTitle: "Location Couldn't Be Auto-Detected",
    manualPinRequiredMsg: "We couldn't detect the location for this photo. Please tap on the map to mark exactly where the issue is.",
    confirmPinLocation: "Confirm Selected Pin Location",
    duplicateWarningTitle: "Similar Complaint Detected Nearby (100m Radius)",
    duplicateWarningMsg: "A similar issue has already been reported nearby. You can view or upvote the existing report to avoid duplicate complaints.",

    // Complaint Categories
    categoryRoadDamage: "Road Damage / Pothole",
    categoryGarbageWaste: "Garbage & Waste Accumulation",
    categoryWaterLeakage: "Water Supply / Pipeline Leakage",
    categoryDrainageSewage: "Drainage Blockage & Sewage Overflow",
    categoryStreetlight: "Streetlight & Electrical Fault",
    categoryTrafficSignal: "Traffic Signal & Safety Defect",
    categoryPublicInfrastructure: "Public Infrastructure Damage",
    categoryOther: "Other Civic Issue",

    // Complaint Statuses
    statusSubmitted: "Submitted",
    statusVerified: "Verified",
    statusApproved: "Approved",
    statusDeptAssigned: "Department Assigned",
    statusStaffAssigned: "Staff Assigned",
    statusAccepted: "Accepted",
    statusOnTheWay: "On the Way",
    statusInProgress: "In Progress",
    statusResolutionSubmitted: "Resolution Submitted",
    statusResolved: "Resolved",
    statusReopened: "Reopened",
    statusRejected: "Rejected",
    statusPending: "Pending",
    statusOverdue: "Overdue",

    // Priorities
    priorityLow: "Low",
    priorityMedium: "Medium",
    priorityHigh: "High",
    priorityCritical: "Critical",

    // Admin Portal
    adminPortalTitle: "Admin Portal",
    allComplaints: "All Complaints",
    newComplaints: "New Complaints",
    pending: "Pending",
    inProgress: "In Progress",
    resolved: "Resolved",
    overdue: "Overdue",
    departments: "Departments",
    departmentHeads: "Department Heads",
    departmentDashboard: "Department Dashboard",
    serviceStaff: "Field Staff",
    cityMap: "City Map",
    analytics: "Analytics",
    reports: "Reports",
    officerDashboardTitle: "Municipal Command Center",
    totalComplaints: "Total Complaints",
    resolvedRate: "Resolution Rate",
    hotspotMapTitle: "Ward-Level Civic Hotspots Map",
    verifyApprove: "Verify & Approve",
    verifyReject: "Reject Complaint",
    assignStaff: "Assign Field Staff",
    possibleDuplicates: "Possible Duplicate Alerts (100m Radius)",
    appointDeptHead: "Appoint Department Head",
    manageStaff: "Manage Field Staff",

    // Department Head Portal
    departmentHeadPortal: "Department Head Portal",
    myDepartment: "My Department",
    assignTask: "Assign Task",
    staff: "Staff",
    pendingReview: "Pending Review",
    taskAssignment: "Task Assignment",
    departmentMap: "Department Map",
    unassignedTasks: "Unassigned Tasks",
    activeStaffCount: "Active Staff Count",
    departmentSlaRate: "Department SLA Compliance",

    // Service Staff Portal
    serviceStaffPortal: "Field Staff Portal",
    myTasks: "My Tasks",
    newAssignments: "New Assignments",
    completed: "Completed",
    taskMap: "Task Map",
    startTask: "Start Task",
    markCompleted: "Mark Completed",
    uploadEvidence: "Upload Evidence",
    openInGoogleMaps: "Navigate with Google Maps",
    uploadProofAndResolve: "Upload Proof & Resolve",
    resolutionProofPhoto: "Upload 'After' Photo Proof",

    // Departments
    deptPWD: "Roads & Public Works Department (PWD)",
    deptSanitation: "Sanitation & Solid Waste Management",
    deptWater: "Water Supply & Sewerage Board",
    deptDrainage: "Drainage & Sewerage Department",
    deptElectrical: "Electrical & Public Lighting Department",
    deptTraffic: "Traffic Engineering & Control Department",
    deptMaintenance: "Maintenance Department",

    // Common Actions & Labels
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    delete: "Delete",
    view: "View",
    search: "Search",
    filter: "Filter",
    apply: "Apply",
    close: "Close",
    back: "Back",
    next: "Next",
    submit: "Submit",
    loading: "Loading...",
    rateResolution: "Rate Resolution",
    giveFeedback: "Submit Star Rating & Feedback",
    preferredLanguage: "Preferred Language",
    savedSuccessfully: "Saved successfully!",
    actions: "Actions",
    dateSubmitted: "Date Submitted",
    assignedTo: "Assigned To",
    contactNumber: "Contact Number",
    status: "Status",
    details: "Details",
    noDataAvailable: "No data available",

    // Announcements
    createAnnouncement: "Create Official Announcement",
    announcementTitle: "Title",
    announcementMessage: "Message / Description",
    englishTitle: "English Title",
    hindiTitle: "Hindi Title",
    marathiTitle: "Marathi Title",
    englishMessage: "English Message",
    hindiMessage: "Hindi Message",
    marathiMessage: "Marathi Message",

    // Empty States
    noComplaintsFound: "No complaints found.",
    noSanitationComplaintsFound: "No sanitation complaints found.",
    noElectricalComplaintsFound: "No electrical complaints found.",
    noNotificationsAvailable: "No notifications available.",
    noTasksAssigned: "No tasks assigned.",
    noAnnouncementsAvailable: "No announcements available.",
    noWorkFound: "No civic works found.",

    // Error Messages
    somethingWentWrong: "Something went wrong.",
    unableToLoadData: "Unable to load data.",
    unableToLoadSanitationData: "Unable to load sanitation department data.",
    unableToLoadElectricalData: "Unable to load Electrical & Street Lighting data.",
    pleaseTryAgain: "Please try again.",

    // Sanitation Department Operational Metrics
    garbageComplaints: "Garbage Complaints",
    overflowingDustbins: "Overflowing Dustbins",
    wasteAccumulation: "Waste Accumulation",
    publicDumping: "Public Dumping",
    collectionRequests: "Collection Requests",
    pendingCleanup: "Pending Cleanup",
    completedCleanup: "Completed Cleanup",
    overdueCleanup: "Overdue Cleanup",

    // Electrical Department Operational Metrics
    brokenStreetlights: "Broken Streetlights",
    streetlightOutages: "Streetlight Outages",
    electricalPoleDamage: "Pole Damage",
    exposedWiring: "Exposed Wiring",
    electricalHazards: "Electrical Hazards",
    lightingMaintenance: "Lighting Maint.",
    pendingRepairs: "Pending Repairs",
    completedRepairs: "Completed Repairs",
    criticalElectricalSafetyAlerts: "Critical Electrical Safety Alerts",

    // AI Analyzer
    aiLargePothole: "Large Road Pothole",
    aiAnalysisComplete: "AI Analysis Complete",
    aiHighConfidence: "High Confidence Issue Detected"
  },

  hi: {
    // App & Navigation
    appTitle: "नगरसेतु",
    tagline: "एआई-संचालित नागरिक समस्या निवारण",
    dashboard: "डैशबोर्ड",
    reportComplaint: "शिकायत दर्ज करें",
    myComplaints: "मेरी शिकायतें",
    nearbyIssues: "आस-पास की समस्याएँ",
    announcements: "घोषणाएँ",
    notifications: "सूचनाएँ",
    profile: "प्रोफ़ाइल",
    settings: "सेटिंग्ज",
    civicWorks: "नागरिक कार्य",
    logout: "लॉग आउट",
    login: "लॉग इन करें",
    register: "पंजीकरण करें",
    welcome: "स्वागत है",
    home: "मुख्य पृष्ठ",
    features: "विशेषताएं",
    howItWorks: "यह कैसे काम करता है",
    getStarted: "शुरू करें",
    portalSelect: "पोर्टल का चयन करें",

    // Roles
    roleCitizen: "नागरिक",
    roleOfficer: "नगर निगम अधिकारी",
    roleStaff: "फील्ड कर्मचारी",
    roleAdmin: "प्रशासक",
    roleDeptHead: "विभाग प्रमुख",

    // Landing Page
    landingHeroTitle: "स्मार्ट नागरिक शिकायत रिपोर्टिंग और नगर निगम संचालन प्रणाली",
    landingHeroSubtitle: "नागरिकों, शहर प्रशासन, विभाग प्रमुखों और फील्ड कर्मचारियों को एक एकीकृत डिजिटल प्लेटफॉर्म पर जोड़ना।",
    reportIssueNow: "अभी शिकायत दर्ज करें",
    trackStatusNow: "शिकायत स्थिति ट्रैक करें",
    aiVisionFeatureTitle: "एआई विज़न वर्गीकरण",
    aiVisionFeatureDesc: "तस्वीरों से नागरिक समस्याओं की स्वचालित पहचान करता है और संबंधित विभाग को भेजता है।",
    geoTaggingFeatureTitle: "सटीक जियो-टैगिंग",
    geoTaggingFeatureDesc: "जीपीएस ट्रैकिंग, फोटो स्थान सत्यापन और मानचित्र पर पिन लगाना।",
    slaTrackingFeatureTitle: "समय सीमा और कार्य आवंटन",
    slaTrackingFeatureDesc: "विभाग प्रमुख फील्ड कर्मचारियों को काम सौंपते हैं और पूरा होने का प्रमाण सत्यापित करते हैं।",
    howItWorksStep1: "1. नागरिक समस्या दर्ज करता है",
    howItWorksStep1Desc: "फोटो अपलोड करें, एआई समस्या को पहचान कर विभाग चुनता है।",
    howItWorksStep2: "2. विभाग प्रमुख काम सौंपता है",
    howItWorksStep2Desc: "विभाग प्रमुख समस्या को संबंधित कर्मचारी को आवंटित करता है।",
    howItWorksStep3: "3. कर्मचारी हल करता है और सत्यापित करता है",
    howItWorksStep3Desc: "कर्मचारी समस्या ठीक कर फोटो प्रमाण अपलोड करता है।",

    // Auth (Login / Register)
    loginTitle: "नगरसेतु में लॉग इन करें",
    loginSubtitle: "अपने डैशबोर्ड तक पहुँच प्राप्त करें",
    mobileOrEmail: "मोबाइल नंबर या आधिकारिक ईमेल",
    enterMobileOrEmail: "10-अंकों का मोबाइल या ईमेल दर्ज करें",
    password: "पासवर्ड",
    enterPassword: "अपना पासवर्ड दर्ज करें",
    rememberMe: "मुझे याद रखें",
    forgotPassword: "पासवर्ड भूल गए?",
    dontHaveAccount: "खाता नहीं है?",
    registerHere: "यहाँ पंजीकरण करें",
    registerTitle: "नागरिक खाता बनाएं",
    registerSubtitle: "शिकायत दर्ज और ट्रैक करने के लिए नगरसेतु से जुड़ें",
    fullName: "पूरा नाम",
    enterFullName: "अपना पूरा नाम दर्ज करें",
    mobileNumber: "10-अंकों का मोबाइल नंबर",
    enterMobileNumber: "10-अंकों का मोबाइल नंबर दर्ज करें",
    emailAddress: "ईमेल पता (वैकल्पिक)",
    enterEmailAddress: "ईमेल पता दर्ज करें",
    confirmPassword: "पासवर्ड की पुष्टि करें",
    alreadyHaveAccount: "पहले से ही खाता है?",
    demoAccounts: "डेमो लॉगिन खाते",

    // Complaint Form & Fields
    complaintTitle: "शिकायत का शीर्षक",
    description: "विवरण",
    category: "श्रेणी",
    location: "स्थान",
    uploadImage: "छवि अपलोड करें",
    submitComplaint: "शिकायत दर्ज करें",
    priority: "प्राथमिकता",
    selectCategory: "श्रेणी चुनें",
    selectPriority: "प्राथमिकता चुनें",
    enterTitle: "वर्णनात्मक शिकायत का शीर्षक दर्ज करें",
    enterDescription: "नागरिक समस्या का विवरण दर्ज करें",
    analyzingPhoto: "एआई फोटो का विश्लेषण और स्थान की पहचान कर रहा है...",
    aiDetectedCategory: "पहचाना गया वर्ग",
    aiTitle: "स्वचालित शीर्षक",
    aiDescription: "स्वचालित विवरण",
    locationSource: "स्थान सत्यापन",
    locationLiveGps: "लाइव डिवाइस जीपीएस (उच्च विश्वास)",
    locationExifGps: "फोटो स्थान जानकारी (EXIF)",
    locationManualPin: "नक्शे पर पिन लगाएं",
    locationConflictTitle: "जीपीएस स्थान अंतर (>500m)",
    locationConflictMsg: "फोटो का स्थान आपके वर्तमान स्थान से अलग है। कृपया सही स्थान चुनें:",
    useLiveGps: "वर्तमान स्थान उपयोग करें",
    useExifGps: "फोटो स्थान उपयोग करें",
    manualPinRequiredTitle: "स्थान स्वतः पहचान नहीं हो सका",
    manualPinRequiredMsg: "हम इस फोटो के लिए स्थान का पता नहीं लगा सके। कृपया सटीक स्थान चिन्हित करने के लिए मानचित्र पर टैप करें।",
    confirmPinLocation: "पिन किए गए स्थान की पुष्टि करें",
    duplicateWarningTitle: "आस-पास समान शिकायत मिली (100 मीटर दायरा)",
    duplicateWarningMsg: "आस-पास पहले से ही ऐसी शिकायत दर्ज है। दोहराव से बचने के लिए आप मौजूदा रिपोर्ट देख सकते हैं।",

    // Complaint Categories
    categoryRoadDamage: "सड़क की खराबी / गड्ढा",
    categoryGarbageWaste: "कचरा व अपशिष्ट जमाव",
    categoryWaterLeakage: "जल आपूर्ति व पाइपलाइन रिसाव",
    categoryDrainageSewage: "जल निकासी व सीवेज ओवरफ्लो",
    categoryStreetlight: "स्ट्रीटलाइट व बिजली की खराबी",
    categoryTrafficSignal: "ट्रैफिक सिग्नल व सुरक्षा दोष",
    categoryPublicInfrastructure: "सार्वजनिक बुनियादी ढांचा क्षति",
    categoryOther: "अन्य नागरिक समस्या",

    // Complaint Statuses
    statusSubmitted: "दर्ज की गई",
    statusVerified: "सत्यापित",
    statusApproved: "स्वीकृत",
    statusDeptAssigned: "विभाग आवंटित",
    statusStaffAssigned: "कर्मचारी को सौंपा गया",
    statusAccepted: "स्वीकार किया गया",
    statusOnTheWay: "रास्ते में",
    statusInProgress: "प्रगति पर",
    statusResolutionSubmitted: "समाधान प्रस्तुत",
    statusResolved: "समाधान किया गया",
    statusReopened: "पुनः खोला गया",
    statusRejected: "अस्वीकृत",
    statusPending: "लंबित",
    statusOverdue: "समय सीमा पार",

    // Priorities
    priorityLow: "कम",
    priorityMedium: "मध्यम",
    priorityHigh: "उच्च",
    priorityCritical: "गंभीर",

    // Admin Portal
    adminPortalTitle: "प्रशासक पोर्टल",
    allComplaints: "सभी शिकायतें",
    newComplaints: "नई शिकायतें",
    pending: "लंबित",
    inProgress: "प्रगति पर",
    resolved: "समाधान किया गया",
    overdue: "समय सीमा पार",
    departments: "विभाग",
    departmentHeads: "विभाग प्रमुख",
    departmentDashboard: "विभाग डैशबोर्ड",
    serviceStaff: "सेवा कर्मचारी",
    cityMap: "शहर का मानचित्र",
    analytics: "विश्लेषण",
    reports: "रिपोर्ट",
    officerDashboardTitle: "नगर निगम कमांड सेंटर",
    totalComplaints: "कुल शिकायतें",
    resolvedRate: "समाधान दर",
    hotspotMapTitle: "वार्ड-वार हॉटस्पॉट मानचित्र",
    verifyApprove: "सत्यापित और स्वीकृत करें",
    verifyReject: "अस्वीकृत करें",
    assignStaff: "कर्मचारी को सौंपें",
    possibleDuplicates: "संभावित डुप्लिकेट शिकायतें",
    appointDeptHead: "विभाग प्रमुख नियुक्त करें",
    manageStaff: "कर्मचारी प्रबंधन",

    // Department Head Portal
    departmentHeadPortal: "विभाग प्रमुख पोर्टल",
    myDepartment: "मेरा विभाग",
    assignTask: "कार्य सौंपें",
    staff: "कर्मचारी",
    pendingReview: "समीक्षा लंबित",
    taskAssignment: "कार्य आवंटन",
    departmentMap: "विभाग मानचित्र",
    unassignedTasks: "गैर-आवंटित कार्य",
    activeStaffCount: "सक्रिय कर्मचारी",
    departmentSlaRate: "विभाग समय सीमा अनुपालन",

    // Service Staff Portal
    serviceStaffPortal: "सेवा कर्मचारी पोर्टल",
    myTasks: "मेरे कार्य",
    newAssignments: "नए कार्य",
    completed: "पूर्ण",
    taskMap: "कार्य मानचित्र",
    startTask: "कार्य शुरू करें",
    markCompleted: "पूर्ण के रूप में चिह्नित करें",
    uploadEvidence: "प्रमाण अपलोड करें",
    openInGoogleMaps: "गूगल मैप्स से रास्ता देखें",
    uploadProofAndResolve: "प्रमाण अपलोड कर हल करें",
    resolutionProofPhoto: "हल का फोटो साक्ष्य",

    // Departments
    deptPWD: "लोक निर्माण विभाग (PWD)",
    deptSanitation: "स्वच्छता एवं अपशिष्ट प्रबंधन",
    deptWater: "जल आपूर्ति एवं सीवरेज बोर्ड",
    deptDrainage: "जल निकासी एवं सीवेज विभाग",
    deptElectrical: "विद्युत एवं स्ट्रीट लाइट विभाग",
    deptTraffic: "यातायात प्रबंधन विभाग",

    // Common Actions & Labels
    save: "सहेजें",
    cancel: "रद्द करें",
    edit: "संपादित करें",
    delete: "हटाएँ",
    view: "देखें",
    search: "खोजें",
    filter: "फ़िल्टर",
    apply: "लागू करें",
    close: "बंद करें",
    back: "वापस",
    next: "आगे",
    submit: "सबमिट करें",
    loading: "लोड हो रहा है...",
    rateResolution: "रेटिंग दें",
    giveFeedback: "स्टार रेटिंग और फीडबैक दें",
    preferredLanguage: "पसंदीदा भाषा",
    savedSuccessfully: "सफलतापूर्वक सहेजा गया!",
    actions: "कार्रवाई",
    dateSubmitted: "दर्ज करने की तारीख",
    assignedTo: "आवंटित कर्मचारी",
    contactNumber: "संपर्क नंबर",
    status: "स्थिति",
    details: "विवरण",
    noDataAvailable: "कोई डेटा उपलब्ध नहीं है",

    // Announcements
    createAnnouncement: "अधिकृत घोषणाएं बनाएं",
    announcementTitle: "शीर्षक",
    announcementMessage: "संदेश / विवरण",
    englishTitle: "अंग्रेजी शीर्षक",
    hindiTitle: "हिंदी शीर्षक",
    marathiTitle: "मराठी शीर्षक",
    englishMessage: "अंग्रेजी संदेश",
    hindiMessage: "हिंदी संदेश",
    marathiMessage: "मराठी संदेश",

    // Empty States
    noComplaintsFound: "कोई शिकायत नहीं मिली।",
    noSanitationComplaintsFound: "स्वच्छता की कोई शिकायत नहीं मिली।",
    noElectricalComplaintsFound: "बिजली की कोई शिकायत नहीं मिली।",
    noNotificationsAvailable: "कोई सूचना उपलब्ध नहीं है।",
    noTasksAssigned: "कोई कार्य सौंपा नहीं गया है।",
    noAnnouncementsAvailable: "कोई घोषणा उपलब्ध नहीं है।",
    noWorkFound: "कोई नागरिक कार्य नहीं मिला।",

    // Error Messages
    somethingWentWrong: "कुछ गलत हो गया।",
    unableToLoadData: "डेटा लोड करने में असमर्थ।",
    unableToLoadSanitationData: "स्वच्छता विभाग का डेटा लोड करने में असमर्थ।",
    unableToLoadElectricalData: "विद्युत विभाग का डेटा लोड करने में असमर्थ।",
    pleaseTryAgain: "कृपया पुनः प्रयास करें।",

    // Sanitation Department Operational Metrics
    garbageComplaints: "कचरा शिकायतें",
    overflowingDustbins: "ओवरफ्लो कूड़ेदान",
    wasteAccumulation: "अपशिष्ट जमाव",
    publicDumping: "सार्वजनिक कचरा डंपिंग",
    collectionRequests: "कचरा संग्रह अनुरोध",
    pendingCleanup: "लंबित सफाई",
    completedCleanup: "पूर्ण सफाई",
    overdueCleanup: "विलंबित सफाई",

    // Electrical Department Operational Metrics
    brokenStreetlights: "टूटी हुई स्ट्रीटलाइट्स",
    streetlightOutages: "स्ट्रीटलाइट ब्लैकआउट",
    electricalPoleDamage: "खंभे की क्षति",
    exposedWiring: "खुले तार",
    electricalHazards: "बिजली के खतरे",
    lightingMaintenance: "लाइटिंग रखरखाव",
    pendingRepairs: "लंबित मरम्मत",
    completedRepairs: "पूर्ण मरम्मत",
    criticalElectricalSafetyAlerts: "गंभीर बिजली सुरक्षा चेतावनियाँ",

    // AI Analyzer
    aiLargePothole: "सड़क पर बड़ा गड्ढा",
    aiAnalysisComplete: "एआई विश्लेषण पूर्ण",
    aiHighConfidence: "उच्च विश्वास के साथ समस्या की पहचान"
  },

  mr: {
    // App & Navigation
    appTitle: "नगरसेतू",
    tagline: "एआय-आधारित नागरी समस्या निवारण",
    dashboard: "डॅशबोर्ड",
    reportComplaint: "तक्रार नोंदवा",
    myComplaints: "माझ्या तक्रारी",
    nearbyIssues: "जवळील समस्या",
    announcements: "घोषणा",
    notifications: "सूचना",
    profile: "प्रोफाइल",
    settings: "सेटिंग्ज",
    civicWorks: "नागरी कामे",
    logout: "बाहेर पडा",
    login: "लॉगिन करा",
    register: "नोंदणी करा",
    welcome: "सुस्वागतम",
    home: "मुख्य पृष्ठ",
    features: "वैशिष्ट्ये",
    howItWorks: "हे कसे कार्य करते",
    getStarted: "शुरू करा",
    portalSelect: "पोर्टल निवडा",

    // Roles
    roleCitizen: "नागरीक",
    roleOfficer: "महापालिका अधिकारी",
    roleStaff: "फील्ड कर्मचारी",
    roleAdmin: "प्रशासक",
    roleDeptHead: "विभाग प्रमुख",

    // Landing Page
    landingHeroTitle: "स्मार्ट नागरी तक्रार निवारण आणि महापालिका कामकाज प्रणाली",
    landingHeroSubtitle: "नागरिक, महापालिका प्रशासन, विभाग प्रमुख आणि फील्ड कर्मचाऱ्यांना एकाच डिजिटल प्लॅटफॉर्मवर जोडणारी प्रणाली.",
    reportIssueNow: "आत्ताच तक्रार नोंदवा",
    trackStatusNow: "तक्रारीची स्थिती तपासा",
    aiVisionFeatureTitle: "एआय व्हिजन वर्गीकरण",
    aiVisionFeatureDesc: "फोटोंवरून नागरी समस्यांची आपोआप ओळख करते आणि संबंधित विभागाकडे पाठवते.",
    geoTaggingFeatureTitle: "अचूक जिओ-टॅगिंग",
    geoTaggingFeatureDesc: "जीपीएस ट्रॅकिंग, फोटो स्थान पडताळणी आणि नकाशावर पिन लावणे.",
    slaTrackingFeatureTitle: "मुदत आणि काम वाटप",
    slaTrackingFeatureDesc: "विभाग प्रमुख फील्ड कर्मचाऱ्यांना काम सोपवतात आणि काम पूर्ण झाल्याचा पुरावा तपासतात.",
    howItWorksStep1: "1. नागरिक समस्या नोंदवतो",
    howItWorksStep1Desc: "फोटो अपलोड करा, एआय समस्येची ओळख पटवून विभाग निवडतो.",
    howItWorksStep2: "2. विभाग प्रमुख काम सोपवतो",
    howItWorksStep2Desc: "विभाग प्रमुख समस्या संबंधित कर्मचाऱ्याला वाटप करतो.",
    howItWorksStep3: "3. कर्मचारी पूर्ण करतो व पडताळतो",
    howItWorksStep3Desc: "कर्मचारी समस्या दुरुस्त करून फोटो पुरावा अपलोड करतो.",

    // Auth (Login / Register)
    loginTitle: "नगरसेतू मध्ये लॉगिन करा",
    loginSubtitle: "आपल्या डॅशबोर्डवर प्रवेश करा",
    mobileOrEmail: "मोबाइल नंबर किंवा अधिकृत ईमेल",
    enterMobileOrEmail: "१०-अंकी मोबाइल किंवा ईमेल टाका",
    password: "पासवर्ड",
    enterPassword: "आपला पासवर्ड टाका",
    rememberMe: "माहिती जतन करा",
    forgotPassword: "पासवर्ड विसरलात?",
    dontHaveAccount: "खाते नाही?",
    registerHere: "येथे नोंदणी करा",
    registerTitle: "नागरिक खाते तयार करा",
    registerSubtitle: "तक्रार नोंदवण्यासाठी आणि मागोवा घेण्यासाठी नगरसेतूशी जोडा",
    fullName: "पूर्ण नाव",
    enterFullName: "आपले पूर्ण नाव टाका",
    mobileNumber: "१०-अंकी मोबाइल नंबर",
    enterMobileNumber: "१०-अंकी मोबाइल नंबर टाका",
    emailAddress: "ईमेल पत्ता (पर्यायी)",
    enterEmailAddress: "ईमेल पत्ता टाका",
    confirmPassword: "पासवर्डची खात्री करा",
    alreadyHaveAccount: "आधीपासून खाते आहे?",
    demoAccounts: "डेमो लॉगिन खाती",

    // Complaint Form & Fields
    complaintTitle: "तक्रारीचे शीर्षक",
    description: "तपशील",
    category: "वर्ग",
    location: "स्थान",
    uploadImage: "प्रतिमा अपलोड करा",
    submitComplaint: "तक्रार सबमिट करा",
    priority: "प्राधान्यक्रम",
    selectCategory: "वर्ग निवडा",
    selectPriority: "प्राधान्य निवडा",
    enterTitle: "तक्रारीचे वर्णन करणारे शीर्षक टाका",
    enterDescription: "समस्येचा तपशील टाका",
    analyzingPhoto: "एआय फोटो तपासत आहे...",
    aiDetectedCategory: "ओळखलेली श्रेणी",
    aiTitle: "आपोआप तयार केलेले शीर्षक",
    aiDescription: "आपोआप तयार केलेले वर्णन",
    locationSource: "स्थान पडताळणी",
    locationLiveGps: "लाइव्ह जीपीएस",
    locationExifGps: "फोटो स्थान माहिती",
    locationManualPin: "नकाशावर पिन लावा",
    locationConflictTitle: "जीपीएस स्थानात फरक (>५०० मी)",
    locationConflictMsg: "फोटोचे स्थान तुमच्या सद्य स्थानापेक्षा वेगळे आहे. कृपया योग्य स्थान निवडा:",
    useLiveGps: "सद्य स्थान वापरा",
    useExifGps: "फोटो स्थान वापरा",
    manualPinRequiredTitle: "स्थान आपोआप सापडले नाही",
    manualPinRequiredMsg: "आम्हाला या फोटोचे स्थान सापडले नाही. कृपया समस्येचे अचूक स्थान चिन्हांकित करण्यासाठी नकाशावर टॅप करा.",
    confirmPinLocation: "निवडलेले स्थान निश्चित करा",
    duplicateWarningTitle: "जवळील समान तक्रार आढळली (१०० मीटर परिसर)",
    duplicateWarningMsg: "जवळच आधीच अशी तक्रार नोंदवली आहे. पुनरावृत्ती टाळण्यासाठी आपण विद्यमान तक्रार पाहू शकता.",

    // Complaint Categories
    categoryRoadDamage: "रस्त्याची खराबी व खड्डे",
    categoryGarbageWaste: "कचरा व घनकचरा साचणे",
    categoryWaterLeakage: "पाणी गळती व पाइपलाइन",
    categoryDrainageSewage: "निचरा व सांडपाणी समस्या",
    categoryStreetlight: "पथदिवा व वीज दोष",
    categoryTrafficSignal: "वाहतूक सिग्नल व सुरक्षा त्रुटी",
    categoryPublicInfrastructure: "सार्वजनिक पायाभूत सुविधा नुकसान",
    categoryOther: "इतर नागरी समस्या",

    // Complaint Statuses
    statusSubmitted: "नोंदवली",
    statusVerified: "पडताळली",
    statusApproved: "मंजूर",
    statusDeptAssigned: "विभाग नियुक्त",
    statusStaffAssigned: "कर्मचारी नियुक्त",
    statusAccepted: "स्वीकारली",
    statusOnTheWay: "रस्त्यात",
    statusInProgress: "प्रगतीपथावर",
    statusResolutionSubmitted: "निराकरण सादर",
    statusResolved: "निराकरण केले",
    statusReopened: "पुन्हा उघडली",
    statusRejected: "नाकारली",
    statusPending: "प्रलंबित",
    statusOverdue: "मुदत संपलेली",

    // Priorities
    priorityLow: "कमी",
    priorityMedium: "मध्यम",
    priorityHigh: "जास्त",
    priorityCritical: "अत्यंत गंभीर",

    // Admin Portal
    adminPortalTitle: "प्रशासक पोर्टल",
    allComplaints: "सर्व तक्रारी",
    newComplaints: "नवीन तक्रारी",
    pending: "प्रलंबित",
    inProgress: "प्रगतीपथावर",
    resolved: "निराकरण केले",
    overdue: "मुदत संपलेली",
    departments: "विभाग",
    serviceStaff: "सेवा कर्मचारी",
    cityMap: "शहराचा नकाशा",
    analytics: "विश्लेषण",
    reports: "अहवाल",
    officerDashboardTitle: "महापालिका कमांड सेंटर",
    totalComplaints: "एकूण तक्रारी",
    resolvedRate: "निवारण दर",
    hotspotMapTitle: "प्रभाग-निहाय हॉटस्पॉट नकाशा",
    verifyApprove: "पडताळून मंजूर करा",
    verifyReject: "तक्रार नाकारा",
    assignStaff: "कर्मचार्‍याला सोपवा",
    possibleDuplicates: "संभाव्य डुप्लिकेट तक्रारी",
    appointDeptHead: "विभाग प्रमुख नियुक्त करा",
    manageStaff: "कर्मचारी व्यवस्थापन",

    // Department Head Portal
    departmentHeadPortal: "विभाग प्रमुख पोर्टल",
    myDepartment: "माझा विभाग",
    assignTask: "काम सोपवा",
    staff: "कर्मचारी",
    pendingReview: "पुनरावलोकन प्रलंबित",
    taskAssignment: "कामाचे वाटप",
    departmentMap: "विभागाचा नकाशा",
    unassignedTasks: "अवाटपित कामे",
    activeStaffCount: "सक्रिय कर्मचारी",
    departmentSlaRate: "विभाग वेळेचे पालन",

    // Service Staff Portal
    serviceStaffPortal: "सेवा कर्मचारी पोर्टल",
    myTasks: "माझी कामे",
    newAssignments: "नवीन कामे",
    completed: "पूर्ण",
    taskMap: "कामाचा नकाशा",
    startTask: "काम सुरू करा",
    markCompleted: "पूर्ण म्हणून चिन्हांकित करा",
    uploadEvidence: "पुरावा अपलोड करा",
    openInGoogleMaps: "गुगल मॅप्सने रस्ता पहा",
    uploadProofAndResolve: "पुरावा अपलोड करून पूर्ण करा",
    resolutionProofPhoto: "काम पूर्ण झाल्याचा फोटो",

    // Departments
    deptPWD: "सार्वजनिक बांधकाम विभाग (PWD)",
    deptSanitation: "स्वच्छता व घनकचरा व्यवस्थापन",
    deptWater: "पाणीपुरवठा व मलनिस्सारण मंडळ",
    deptDrainage: "निचरा व सांडपाणी विभाग",
    deptElectrical: "विद्युत व पथदिवे विभाग",
    deptTraffic: "वाहतूक व्यवस्थापन विभाग",

    // Common Actions & Labels
    save: "जतन करा",
    cancel: "रद्द करा",
    edit: "संपादित करा",
    delete: "हटवा",
    view: "पहा",
    search: "शोधा",
    filter: "फिल्टर",
    apply: "लागू करा",
    close: "बंद करा",
    back: "मागे",
    next: "पुढे",
    submit: "सबमिट करा",
    loading: "लोड होत आहे...",
    rateResolution: "रेटिंग द्या",
    giveFeedback: "स्टार रेटिंग आणि अभिप्राय द्या",
    preferredLanguage: "पसंतीची भाषा",
    savedSuccessfully: "यशस्वीपणे जतन केले!",
    actions: "कृती",
    dateSubmitted: "नोंदणी तारीख",
    assignedTo: "नियुक्त कर्मचारी",
    contactNumber: "संपर्क क्रमांक",
    status: "स्थिती",
    details: "तपशील",
    noDataAvailable: "माहिती उपलब्ध नाही",

    // Announcements
    createAnnouncement: "अधिकृत घोषणा तयार करा",
    announcementTitle: "शीर्षक",
    announcementMessage: "संदेश / तपशील",
    englishTitle: "इंग्रजी शीर्षक",
    hindiTitle: "हिंदी शीर्षक",
    marathiTitle: "मराठी शीर्षक",
    englishMessage: "इंग्रजी संदेश",
    hindiMessage: "हिंदी संदेश",
    marathiMessage: "मराठी संदेश",

    // Empty States
    noComplaintsFound: "कोणतीही तक्रार आढळली नाही.",
    noSanitationComplaintsFound: "स्वच्छतेची कोणतीही तक्रार आढळली नाही.",
    noElectricalComplaintsFound: "विद्युत विभागाची कोणतीही तक्रार आढळली नाही.",
    noNotificationsAvailable: "कोणत्याही सूचना उपलब्ध नाहीत.",
    noTasksAssigned: "कोणतेही काम सोपवलेले नाही.",
    noAnnouncementsAvailable: "कोणत्याही घोषणा उपलब्ध नाहीत.",
    noWorkFound: "कोणतेही नागरी काम आढळले नाही.",

    // Error Messages
    somethingWentWrong: "काहीतरी चुकीचे झाले.",
    unableToLoadData: "डेटा लोड करता आला नाही.",
    unableToLoadSanitationData: "स्वच्छता विभागाचा डेटा लोड करता आला नाही.",
    unableToLoadElectricalData: "विद्युत विभागाचा डेटा लोड करता आला नाही.",
    pleaseTryAgain: "कृपया पुन्हा प्रयत्न करा.",

    // Sanitation Department Operational Metrics
    garbageComplaints: "कचरा तक्रारी",
    overflowingDustbins: "ओव्हरफ्लो कचराकुंड्या",
    wasteAccumulation: "कचरा साचणे",
    publicDumping: "सार्वजनिक कचरा डंपिंग",
    collectionRequests: "कचरा संकलन विनंत्या",
    pendingCleanup: "प्रलंबित स्वच्छता",
    completedCleanup: "पूर्ण स्वच्छता",
    overdueCleanup: "विलंबित स्वच्छता",

    // Electrical Department Operational Metrics
    brokenStreetlights: "पडलेले/खराब पथदिवे",
    streetlightOutages: "पथदिवे बंद असणे",
    electricalPoleDamage: "खांबाचे नुकसान",
    exposedWiring: "उघड्या विजेच्या तारा",
    electricalHazards: "विजेचे धोके",
    lightingMaintenance: "प्रकाश व्यवस्था देखभाल",
    pendingRepairs: "प्रलंबित दुरुस्ती",
    completedRepairs: "पूर्ण दुरुस्ती",
    criticalElectricalSafetyAlerts: "गंभीर विद्युत सुरक्षा इशारे",

    // AI Analyzer
    aiLargePothole: "रस्त्यावर मोठा खड्डा",
    aiAnalysisComplete: "एआय विश्लेषण पूर्ण",
    aiHighConfidence: "उच्च आत्मविश्वासाने समस्या आढळली"
  }
};

/**
 * Get translation for a key. Falls back to English if missing in target language.
 */
export function t(key: string, lang: SupportedLanguage = 'en'): string {
  if (translations[lang] && translations[lang][key]) {
    return translations[lang][key];
  }
  if (translations['en'] && translations['en'][key]) {
    return translations['en'][key];
  }
  return key;
}

/**
 * Helper to translate Category names dynamically based on DB string or key.
 */
export function translateCategory(catName?: string, lang: SupportedLanguage = 'en'): string {
  if (!catName) return '';
  const normalized = catName.trim().toLowerCase();
  
  if (normalized.includes('road') || normalized.includes('pothole')) return t('categoryRoadDamage', lang);
  if (normalized.includes('garbage') || normalized.includes('waste')) return t('categoryGarbageWaste', lang);
  if (normalized.includes('water') || normalized.includes('leakage') || normalized.includes('pipeline')) return t('categoryWaterLeakage', lang);
  if (normalized.includes('drainage') || normalized.includes('sewage') || normalized.includes('drain')) return t('categoryDrainageSewage', lang);
  if (normalized.includes('streetlight') || normalized.includes('light') || normalized.includes('electrical')) return t('categoryStreetlight', lang);
  if (normalized.includes('traffic') || normalized.includes('signal')) return t('categoryTrafficSignal', lang);
  if (normalized.includes('infrastructure') || normalized.includes('public')) return t('categoryPublicInfrastructure', lang);
  
  return catName;
}

/**
 * Helper to translate Complaint Status strings dynamically.
 */
export function translateStatus(status?: string, lang: SupportedLanguage = 'en'): string {
  if (!status) return '';
  const normalized = status.trim().toLowerCase();
  
  if (normalized === 'submitted') return t('statusSubmitted', lang);
  if (normalized === 'verified') return t('statusVerified', lang);
  if (normalized === 'approved') return t('statusApproved', lang);
  if (normalized === 'department assigned' || normalized === 'dept_assigned') return t('statusDeptAssigned', lang);
  if (normalized === 'staff assigned' || normalized === 'staff_assigned') return t('statusStaffAssigned', lang);
  if (normalized === 'accepted') return t('statusAccepted', lang);
  if (normalized === 'on the way' || normalized === 'ontheway') return t('statusOnTheWay', lang);
  if (normalized === 'in progress' || normalized === 'in_progress') return t('statusInProgress', lang);
  if (normalized === 'resolution submitted') return t('statusResolutionSubmitted', lang);
  if (normalized === 'resolved') return t('statusResolved', lang);
  if (normalized === 'reopened') return t('statusReopened', lang);
  if (normalized === 'rejected') return t('statusRejected', lang);
  if (normalized === 'pending') return t('statusPending', lang);
  if (normalized === 'overdue') return t('statusOverdue', lang);
  
  return status;
}

/**
 * Helper to translate Priority levels.
 */
export function translatePriority(priority?: string, lang: SupportedLanguage = 'en'): string {
  if (!priority) return '';
  const normalized = priority.trim().toLowerCase();
  
  if (normalized === 'low') return t('priorityLow', lang);
  if (normalized === 'medium') return t('priorityMedium', lang);
  if (normalized === 'high') return t('priorityHigh', lang);
  if (normalized === 'critical') return t('priorityCritical', lang);
  
  return priority;
}

/**
 * Helper to translate Department Names.
 */
export function translateDepartment(deptName?: string, lang: SupportedLanguage = 'en'): string {
  if (!deptName) return '';
  const normalized = deptName.trim().toLowerCase();
  
  if (normalized.includes('public works') || normalized.includes('pwd') || normalized.includes('road')) return t('deptPWD', lang);
  if (normalized.includes('sanitation') || normalized.includes('waste') || normalized.includes('garbage')) return t('deptSanitation', lang);
  if (normalized.includes('water') || normalized.includes('pipeline')) return t('deptWater', lang);
  if (normalized.includes('drainage') || normalized.includes('sewerage') || normalized.includes('sewage')) return t('deptDrainage', lang);
  if (normalized.includes('electrical') || normalized.includes('light') || normalized.includes('lighting')) return t('deptElectrical', lang);
  if (normalized.includes('traffic') || normalized.includes('signal')) return t('deptTraffic', lang);
  if (normalized.includes('maintenance') || normalized.includes('mnt')) return t('deptMaintenance', lang);
  
  return deptName;
}

