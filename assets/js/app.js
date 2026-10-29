import { openCncReports } from "./cnc-report-ui.js?v=20261029-status-only";
import { cncDisplayState, cncIsFresh, cncMeasurement, cncMode, cncDuration } from "./cnc-status.js?v=20261029-status-only";

    import { initializeSession, onSessionChanged, signIn, signOutUser, sendVerification, registerAccount, getToken, getUser, loadProfile, role, canEdit, displayName } from "./auth.js?v=20261026-login";
    import { firebaseConfig } from "./firebase-config.js";

    const DB_URL = firebaseConfig.databaseURL;

    if (!sessionStorage.getItem("ltd_user_session_id")) {
      sessionStorage.setItem("ltd_user_session_id", crypto.randomUUID());
    }
    const mySessionId = sessionStorage.getItem("ltd_user_session_id");

    let items = [];
    let activities = [];
    let repairHistory = [];
    let stockMovements = [];
    let machines = [];
    let maintenanceJobs = []; 
    let cncs = []; // Mảng quản lý máy CNC mới
    let cncAlarmHistory = []; // Mảng lưu lịch sử Alarm CNC
    let cncAlarmHistoryViewId = null;
    let cncRealtimeSyncStarted = false;
    let deviceHistory = [];
    let accountHistory = [];
    let appStarted = false;
    const expandedMaintenanceMachineIds = new Set();
    let adminAuditOpen = false;
    let manualLoginInProgress = false;

    const number = new Intl.NumberFormat("vi-VN");

    // Icons SVG sử dụng cho nút bấm thao tác hàng loạt
    const editIcon = `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`;
    const deleteIcon = `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;
    const plusMinusIcon = `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2zM5 19h14v-2H5v2z"/></svg>`;
    const checkIcon = `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`;

    const els = {
      todayLabel: document.querySelector("#todayLabel"),
      pageHeading: document.querySelector("#pageHeading"),
      pageSubtitle: document.querySelector("#pageSubtitle"),
      overviewPage: document.querySelector("#overviewPage"),
      inventoryPage: document.querySelector("#inventoryPage"),
      cncMonitoringPage: document.querySelector("#cncMonitoringPage"), // TAB MỚI
      machinesPage: document.querySelector("#machinesPage"),
      maintenanceJobsPage: document.querySelector("#maintenanceJobsPage"),
      historyPage: document.querySelector("#historyPage"),
      addBtn: document.querySelector("#addBtn"),
      addMachineMainBtn: document.querySelector("#addMachineMainBtn"),
      addCncMainBtn: document.querySelector("#addCncMainBtn"), // NÚT MỚI
      addJobMainBtn: document.querySelector("#addJobMainBtn"),
      addMaintenanceMachineBtn: document.querySelector("#addMaintenanceMachineBtn"),
      exportBtn: document.querySelector("#exportBtn"),
      exportMachineBtn: document.querySelector("#exportMachineBtn"),
      exportCncBtn: document.querySelector("#exportCncBtn"), // NÚT MỚI
      exportCncAlarmBtn: document.querySelector("#exportCncAlarmBtn"),
      exportJobBtn: document.querySelector("#exportJobBtn"),
      exportHistoryBtn: document.querySelector("#exportHistoryBtn"),
      statItems: document.querySelector("#statItems"),
      statUnits: document.querySelector("#statUnits"),
      statValue: document.querySelector("#statValue"),
      statLow: document.querySelector("#statLow"),
      statCncTotal: document.querySelector("#statCncTotal"), // STAT MỚI
      statCncRunning: document.querySelector("#statCncRunning"), // STAT MỚI
      statCncHold: document.querySelector("#statCncHold"), // STAT MỚI
      statCncAlarm: document.querySelector("#statCncAlarm"), // STAT MỚI
      cncConnectionReady: document.querySelector("#cncConnectionReady"),
      resultCount: document.querySelector("#resultCount"),
      inventoryBody: document.querySelector("#inventoryBody"),
      movementHistoryList: document.querySelector("#movementHistoryList"),
      machineListBody: document.querySelector("#machineListBody"),
      jobListBody: document.querySelector("#jobListBody"),
      maintenanceScheduleBoard: document.querySelector("#maintenanceScheduleBoard"),
      historyList: document.querySelector("#historyList"),
      historyActionsHeading: document.querySelector("#historyActionsHeading"),
      deviceHistoryList: document.querySelector("#deviceHistoryList"),
      accountHistoryList: document.querySelector("#accountHistoryList"),
      adminAuditEntry: document.querySelector("#adminAuditEntry"),
      adminAuditPanel: document.querySelector("#adminAuditPanel"),
      toggleAdminAuditBtn: document.querySelector("#toggleAdminAuditBtn"),
      searchInput: document.querySelector("#searchInput"),
      skuSearchInput: document.querySelector("#skuSearchInput"),
      machineSearchInput: document.querySelector("#machineSearchInput"),
      jobSearchInput: document.querySelector("#jobSearchInput"),
      historySearchInput: document.querySelector("#historySearchInput"),
      historyFromInput: document.querySelector("#historyFromInput"),
      historyToInput: document.querySelector("#historyToInput"),
      cncSearchInput: document.querySelector("#cncSearchInput"), // SEARCH MỚI
      categoryFilter: document.querySelector("#categoryFilter"),
      statusFilter: document.querySelector("#statusFilter"),
      alertList: document.querySelector("#alertList"),
      activityList: document.querySelector("#activityList"),
      
      itemDialog: document.querySelector("#itemDialog"),
      itemForm: document.querySelector("#itemForm"),
      dialogTitle: document.querySelector("#dialogTitle"),
      itemId: document.querySelector("#itemId"),
      nameInput: document.querySelector("#nameInput"),
      skuInput: document.querySelector("#skuInput"),
      categoryInput: document.querySelector("#categoryInput"),
      supplierInput: document.querySelector("#supplierInput"),
      quantityInput: document.querySelector("#quantityInput"),
      minInput: document.querySelector("#minInput"),
      priceInput: document.querySelector("#priceInput"),
      locationInput: document.querySelector("#locationInput"),
      specsInput: document.querySelector("#specsInput"),
      noteInput: document.querySelector("#noteInput"),
      itemImageInput: document.querySelector("#itemImageInput"),
      itemImageDataHidden: document.querySelector("#itemImageDataHidden"),
      itemImagePreviewWrap: document.querySelector("#itemImagePreviewWrap"),
      itemImagePreview: document.querySelector("#itemImagePreview"),

      cncDialog: document.querySelector("#cncDialog"), // DIALOG MỚI
      cncForm: document.querySelector("#cncForm"),
      cncTitle: document.querySelector("#cncTitle"),
      cncId: document.querySelector("#cncId"),
      cncNameInput: document.querySelector("#cncNameInput"),
      cncIpInput: document.querySelector("#cncIpInput"),
      cncPortInput: document.querySelector("#cncPortInput"),
      cncModelInput: document.querySelector("#cncModelInput"),

      cncAlarmHistoryDialog: document.querySelector("#cncAlarmHistoryDialog"),
      cncAlarmHistoryTitle: document.querySelector("#cncAlarmHistoryTitle"),
      cncAlarmHistoryMeta: document.querySelector("#cncAlarmHistoryMeta"),
      cncMachineAlarmHistoryBody: document.querySelector("#cncMachineAlarmHistoryBody"),

      moveDialog: document.querySelector("#moveDialog"),
      moveForm: document.querySelector("#moveForm"),
      moveTitle: document.querySelector("#moveTitle"),
      moveItemId: document.querySelector("#moveItemId"),
      moveType: document.querySelector("#moveType"),
      moveAmount: document.querySelector("#moveAmount"),
      moveNote: document.querySelector("#moveNote"),

      historyDialog: document.querySelector("#historyDialog"),
      historyForm: document.querySelector("#historyForm"),
      historyTitle: document.querySelector("#historyTitle"),
      historyId: document.querySelector("#historyId"),
      machineInput: document.querySelector("#machineInput"),
      faultTimeInput: document.querySelector("#faultTimeInput"),
      staffInput: document.querySelector("#staffInput"),
      faultInput: document.querySelector("#faultInput"),
      fixInput: document.querySelector("#fixInput"),
      historyImageInput: document.querySelector("#historyImageInput"),
      historyImageDataHidden: document.querySelector("#historyImageDataHidden"),
      historyImagePreviewWrap: document.querySelector("#historyImagePreviewWrap"),
      historyImagePreview: document.querySelector("#historyImagePreview"),

      machineDialog: document.querySelector("#machineDialog"),
      machineForm: document.querySelector("#machineForm"),
      machineTitle: document.querySelector("#machineTitle"),
      mId: document.querySelector("#machineId"),
      mName: document.querySelector("#mNameInput"),
      mModel: document.querySelector("#mModelInput"),
      mSerial: document.querySelector("#mSerialInput"),
      mSetupDate: document.querySelector("#mSetupDateInput"),
      mWarranty: document.querySelector("#mWarrantyInput"),
      mVendor: document.querySelector("#mVendorInput"),
      mPhone: document.querySelector("#mPhoneInput"),

      jobDialog: document.querySelector("#jobDialog"),
      jobForm: document.querySelector("#jobForm"),
      jobTitle: document.querySelector("#jobTitle"),
      jId: document.querySelector("#jobId"),
      jMachineSelect: document.querySelector("#jMachineSelect"),
      jName: document.querySelector("#jNameInput"),
      jFrequency: document.querySelector("#jFrequencyInput"),
      jNextDate: document.querySelector("#jNextDateInput"),
      jOwner: document.querySelector("#jOwnerInput"),
      jEstimatedTime: document.querySelector("#jEstimatedTimeInput"),
      jDesc: document.querySelector("#jDescInput"),

      loginForm: document.querySelector("#loginForm"),
      emailInput: document.querySelector("#emailInput"),
      passwordInput: document.querySelector("#passwordInput"),
      fullNameInput: document.querySelector("#fullNameInput"),
      confirmPasswordInput: document.querySelector("#confirmPasswordInput"),
      registrationFields: document.querySelector("#registrationFields"),
      toggleRegistrationBtn: document.querySelector("#toggleRegistrationBtn"),
      submitLoginBtn: document.querySelector("#submitLoginBtn"),
      sessionBadge: document.querySelector("#sessionBadge"),
      loginError: document.querySelector("#loginError"),
      toast: document.querySelector("#toast")
    };

    // Thiết lập ngày tháng năm hiện tại
    els.todayLabel.textContent = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long", day: "2-digit", month: "2-digit", year: "numeric"
    }).format(new Date());

    async function fbFetch(path, method = "GET", body = null, strict = false) {
      const token = await getToken();
      if (!token) throw new Error("Phiên đăng nhập đã hết hạn.");
      const isPresence = path.startsWith("online_users/");
      if (["PUT", "POST", "PATCH", "DELETE"].includes(method) && !isPresence && !canEdit()) {
        showToast("Tài khoản của bạn chỉ có quyền xem dữ liệu.");
        return null;
      }
      const options = { method };
      if (body) {
        options.headers = { "Content-Type": "application/json" };
        options.body = JSON.stringify(body);
      }
      try {
        const res = await fetch(`${DB_URL}/${path}.json?auth=${encodeURIComponent(token)}`, options);
        if (!res.ok) throw new Error(`Firebase trả về ${res.status}`);
        return await res.json();
      } catch (err) {
        console.error("Lỗi đám mây:", err);
        if (strict) throw err;
        return null;
      }
    }

    async function writeAudit(node, entry) {
      const user = getUser();
      const token = await getToken();
      if (!user || !token) return;
      const id = crypto.randomUUID();
      const record = { id, uid: user.uid, actor: displayName(), at: new Date().toISOString(), ...entry };
      const response = await fetch(`${DB_URL}/${node}/${id}.json?auth=${encodeURIComponent(token)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record)
      });
      if (!response.ok) throw new Error("Không thể ghi lịch sử hệ thống.");
      return record;
    }

    async function writeAccountHistory(action) {
      try { await writeAudit(`accountHistory/${getUser().uid}`, { action, email: getUser().email }); } catch (error) { console.warn(error); }
    }

    async function writeDeviceHistory(device, action) {
      try { await writeAudit("deviceHistory", { device, action }); } catch (error) { console.warn(error); }
    }

    async function loadCloudData() {
      if(els.resultCount) els.resultCount.textContent = "Đang đồng bộ dữ liệu đám mây...";
      try {
        const [cloudItems, cloudActivities, cloudHistory, cloudMovements, cloudMachines, cloudJobs, cloudCncs, cloudCncAlarms] = await Promise.all([
          fbFetch("items"),
          fbFetch("activities"),
          fbFetch("repairHistory"),
          fbFetch("stockMovements"),
          fbFetch("machines"),
          fbFetch("maintenanceJobs"),
          fbFetch("cncs"), // Tải dữ liệu CNC
          fbFetch("cncAlarms") // Tải dữ liệu lịch sử Alarm CNC
        ]);

        items = cloudItems ? Object.values(cloudItems) : [];
        activities = cloudActivities ? Object.values(cloudActivities) : [{ at: new Date().toISOString(), text: "Hệ thống mây đã sẵn sàng." }];
        repairHistory = cloudHistory ? Object.values(cloudHistory) : [];
        stockMovements = cloudMovements ? Object.values(cloudMovements) : [];
        machines = cloudMachines ? Object.values(cloudMachines) : [];
        maintenanceJobs = cloudJobs ? Object.values(cloudJobs) : [];
        cncs = cloudCncs ? Object.values(cloudCncs) : [];
        cncAlarmHistory = cloudCncAlarms ? Object.values(cloudCncAlarms) : [];

        cncs.forEach(c => ensureAlarmRecorded(c));
        if (cncs.some(c => c.status === "alarm" && c.alarm)) {
          await syncNode("cncAlarms", cncAlarmHistory);
        }

        render();
        showToast("Đã cập nhật dữ liệu trực tuyến mới nhất.");

        // Quản lý số người trực tuyến bằng cách gửi ping mỗi 15s
        await fbFetch(`online_users/${mySessionId}`, "PUT", { uid: getUser().uid, timestamp: Date.now() });
        setInterval(async () => {
          try { await fbFetch(`online_users/${mySessionId}`, "PUT", { uid: getUser().uid, timestamp: Date.now() }); } catch(e){}
        }, 15000);

        setTimeout(checkOnlineUsers, 500);
        setInterval(checkOnlineUsers, 12000);

        // Live telemetry is supplied only by an authenticated external bridge.
        startCncRealtimeSync();
      } catch (e) {
        console.error("Lỗi kết nối máy chủ:", e);
      }
    }

    function startCncRealtimeSync() {
      if (cncRealtimeSyncStarted) return;
      cncRealtimeSyncStarted = true;
      setInterval(async () => {
        if (!getUser()) return;
        try {
          const [cloudCncs, cloudCncAlarms] = await Promise.all([
            fbFetch("cncs", "GET", null, true), fbFetch("cncAlarms", "GET", null, true)
          ]);
          cncs = cloudCncs ? Object.values(cloudCncs) : [];
          cncAlarmHistory = cloudCncAlarms ? Object.values(cloudCncAlarms) : [];
          let hasNewAlarm = false;
          cncs.forEach(c => { if (ensureAlarmRecorded(c)) hasNewAlarm = true; });
          if (hasNewAlarm) await syncNode("cncAlarms", cncAlarmHistory);
        } catch (error) {
          // Preserve the last snapshot; freshness checks below expire it independently.
        } finally {
          els.statCncTotal.textContent = number.format(cncs.length);
          els.statCncRunning.textContent = number.format(cncs.filter(c => cncDisplayState(c).status === "running").length);
          els.statCncHold.textContent = number.format(cncs.filter(c => cncDisplayState(c).status === "hold").length);
          els.statCncAlarm.textContent = number.format(cncs.filter(c => cncDisplayState(c).status === "alarm").length);
          if (els.cncConnectionReady) els.cncConnectionReady.textContent = `${cncs.filter(c => cncIsFresh(c)).length} / ${cncs.length}`;
          if (!els.cncMonitoringPage.hidden) renderCncTable();
          updateOverviewQuickStats();
          renderAlertsAndActivities();
          if (cncAlarmHistoryViewId && els.cncAlarmHistoryDialog.open) renderCncMachineAlarmHistory(cncAlarmHistoryViewId);
        }
      }, 5000);
    }

    function extractAlarmCode(alarmText) {
      const match = String(alarmText || "").match(/\b(SV|SP|OT|AL)\d{3,4}\b/i);
      return match ? match[0].toUpperCase() : "UNKNOWN";
    }

    function ensureAlarmRecorded(c) {
      if (c.source === "focas" || cncDisplayState(c).status !== "alarm" || !c.alarm) return false;
      const exists = cncAlarmHistory.some(a =>
        a.cncId === c.id && !a.resolvedAt && a.description === c.alarm
      );
      if (exists) return false;

      cncAlarmHistory.push({
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        cncId: c.id,
        cncName: c.name,
        alarmCode: extractAlarmCode(c.alarm),
        description: c.alarm
      });
      return true;
    }

    async function checkOnlineUsers() {
      try {
        const allSessions = await fbFetch("online_users");
        if (allSessions) {
          const now = Date.now();
          let activeCount = 0;
          for (const id in allSessions) {
            if (now - allSessions[id].timestamp < 45000) { activeCount++; } 
            // Chỉ chủ phiên mới được Firebase Rules cho phép xóa phiên của mình.
          }
          const label = document.querySelector("#onlineCountLabel");
          if (label) {
            label.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; animation: rise 1.5s infinite alternate;"></span> Đang truy cập: <span style="font-size:14px; background:#fff; color:#0f241d; padding:2px 8px; border-radius:99px; font-weight:800; margin:0 4px;">${Math.max(1, activeCount)}</span> người`;
          }
        }
      } catch(e){}
    }

    async function syncNode(nodeName, dataArray) {
      try {
        const obj = {};
        dataArray.forEach(item => { if(item.id) obj[item.id] = item; });
        await fbFetch(nodeName, "PUT", obj);
      } catch(e){}
    }

    let registrationMode = false;

    function setRegistrationMode(enabled) {
      registrationMode = enabled;
      els.registrationFields.hidden = !enabled;
      els.fullNameInput.required = enabled;
      els.confirmPasswordInput.required = enabled;
      els.passwordInput.autocomplete = enabled ? "new-password" : "current-password";
      els.submitLoginBtn.textContent = enabled ? "Tạo tài khoản" : "Đăng Nhập";
      els.toggleRegistrationBtn.textContent = enabled ? "Quay lại đăng nhập" : "Tạo tài khoản mới";
      els.loginError.textContent = "";
    }

    async function login(event) {
      if (event) { event.preventDefault(); event.stopPropagation(); }
      if (manualLoginInProgress) return false;
      manualLoginInProgress = true;
      els.submitLoginBtn.disabled = true;
      els.toggleRegistrationBtn.disabled = true;
      const userVal = els.emailInput.value.trim();
      const passVal = els.passwordInput.value;
      els.loginError.textContent = "";
      try {
        await initialSessionReady;
        if (registrationMode) {
          if (passVal !== els.confirmPasswordInput.value) throw new Error("password-mismatch");
          if (passVal.length < 6) throw new Error("weak-password");
          await registerAccount({ displayName: els.fullNameInput.value.trim(), email: userVal, password: passVal });
          await signOutUser();
          setRegistrationMode(false);
          els.loginError.textContent = "Tài khoản đã tạo. Hãy xác minh email rồi đăng nhập.";
          return false;
        }
        const credential = await signIn(userVal, passVal);
        if (!credential.user.emailVerified) {
          await sendVerification(credential.user);
          await signOutUser();
          els.loginError.textContent = "Email chưa được xác minh. Liên kết xác minh đã được gửi lại, vui lòng mở email rồi đăng nhập lại.";
          return false;
        }
        sessionStorage.setItem("ltd_explicit_cmms_login", "1");
        if (!await unlockApp()) {
          sessionStorage.removeItem("ltd_explicit_cmms_login");
          return false;
        }
        await writeAccountHistory("Đăng nhập thành công");
      } catch (error) {
        const messages = {
          "auth/invalid-credential": "Email hoặc mật khẩu không hợp lệ.",
          "auth/invalid-login-credentials": "Email hoặc mật khẩu không hợp lệ.",
          "auth/wrong-password": "Email hoặc mật khẩu không hợp lệ.",
          "auth/user-not-found": "Email hoặc mật khẩu không hợp lệ.",
          "auth/invalid-email": "Địa chỉ email không hợp lệ.",
          "auth/network-request-failed": "Không thể kết nối máy chủ đăng nhập. Vui lòng kiểm tra mạng rồi thử lại.",
          "auth/too-many-requests": "Có quá nhiều lần đăng nhập. Vui lòng chờ một lúc rồi thử lại.",
          "auth/user-disabled": "Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.",
          "auth/email-already-in-use": "Email này đã được đăng ký.",
          "auth/weak-password": "Mật khẩu cần có ít nhất 6 ký tự.",
          "weak-password": "Mật khẩu cần có ít nhất 6 ký tự.",
          "password-mismatch": "Mật khẩu xác nhận không khớp."
        };
        els.loginError.textContent = messages[error.code || error.message] || "Không thể hoàn tất đăng nhập. Vui lòng thử lại hoặc liên hệ quản trị viên.";
        return false;
      } finally {
        manualLoginInProgress = false;
        els.submitLoginBtn.disabled = false;
        els.toggleRegistrationBtn.disabled = false;
      }
      return false;
    }

    async function unlockApp() {
      if (appStarted) return true;
      appStarted = true;
      try {
        await loadProfile();
      } catch (error) {
        appStarted = false;
        await signOutUser();
        els.loginError.textContent = "Tài khoản chưa được cấp quyền CMMS. Vui lòng liên hệ quản trị viên.";
        return false;
      }
      document.body.classList.remove("locked"); 
      document.body.dataset.role = role();
      els.sessionBadge.textContent = `${displayName()} · ${role().toUpperCase()}`;
      applyAuthorization();
      render();
      loadCloudData();
      showToast(`Chào mừng, ${displayName()}. Vai trò: ${role()}.`);
      return true;
    }
    
    async function logout() {
      try {
        await writeAccountHistory("Đăng xuất");
        if (typeof mySessionId !== "undefined") await fbFetch(`online_users/${mySessionId}`, "DELETE");
      } catch(e) {}
      await signOutUser();
      appStarted = false;
      sessionStorage.removeItem("ltd_explicit_cmms_login");
      document.body.classList.add("locked"); 
      document.body.removeAttribute("data-role");
      els.sessionBadge.textContent = "Chưa đăng nhập";
    }

  
    function applyAuthorization() {
      const allowedToEdit = canEdit();
      const isAdmin = role() === "admin";
      els.adminAuditEntry.hidden = !isAdmin;
      els.historyActionsHeading.hidden = !isAdmin;
      if (!isAdmin) {
        adminAuditOpen = false;
        els.adminAuditPanel.hidden = true;
      }
      document.querySelectorAll("button.primary, button.danger, #addMachineBtn, #addCncBtn, #addJobBtn").forEach(button => {
        if (button.closest(".login-screen")) return;
        button.disabled = true;
        button.title = "Tài khoản chỉ có quyền xem. Liên hệ quản lý để được cấp quyền chỉnh sửa.";
        button.disabled = !allowedToEdit;
        button.title = allowedToEdit
          ? ""
          : "Tài khoản chỉ có quyền xem. Liên hệ quản lý để được cấp quyền chỉnh sửa.";
      });
    }


    function switchPage(pageId) {
      els.overviewPage.hidden = (pageId !== "overviewPage");
      els.inventoryPage.hidden = (pageId !== "inventoryPage");
      els.cncMonitoringPage.hidden = (pageId !== "cncMonitoringPage");
      els.machinesPage.hidden = (pageId !== "machinesPage");
      els.maintenanceJobsPage.hidden = (pageId !== "maintenanceJobsPage");
      els.historyPage.hidden = (pageId !== "historyPage");

      els.addBtn.style.display = (pageId === "inventoryPage") ? "inline-flex" : "none";
      els.addCncMainBtn.style.display = (pageId === "cncMonitoringPage") ? "inline-flex" : "none";
      els.addMachineMainBtn.style.display = (pageId === "machinesPage") ? "inline-flex" : "none";
      els.addJobMainBtn.style.display = (pageId === "maintenanceJobsPage") ? "inline-flex" : "none";
      els.exportBtn.style.display = (pageId === "inventoryPage") ? "inline-flex" : "none";
      els.exportCncBtn.style.display = (pageId === "cncMonitoringPage") ? "inline-flex" : "none";
      els.exportCncAlarmBtn.style.display = (pageId === "cncMonitoringPage") ? "inline-flex" : "none";
      els.exportMachineBtn.style.display = (pageId === "machinesPage") ? "inline-flex" : "none";
      els.exportJobBtn.style.display = (pageId === "maintenanceJobsPage") ? "inline-flex" : "none";
      els.exportHistoryBtn.style.display = (pageId === "historyPage") ? "inline-flex" : "none";

      if(pageId === "overviewPage") {
        els.pageHeading.textContent = "TỔNG QUAN HỆ THỐNG LTD";
        els.pageSubtitle.textContent = "Theo dõi nhanh tồn kho, cảnh báo bảo trì, trạng thái máy CNC và hoạt động gần đây.";
      } else if(pageId === "inventoryPage") {
        els.pageHeading.textContent = "HỆ THỐNG KHO LTD";
        els.pageSubtitle.textContent = "Quản lý linh kiện bảo trì: mã linh kiện, vị trí kệ và số lượng còn trong kho.";
      } else if(pageId === "cncMonitoringPage") {
        els.pageHeading.textContent = "GIÁM SÁT MÁY CNC FANUC";
        els.pageSubtitle.textContent = "Kết nối trực tiếp hệ điều khiển Fanuc 0i-F, theo dõi Feedrate, Tốc độ trục chính, Chương trình và Alarm liên kết kho.";
      } else if(pageId === "machinesPage") {
        els.pageHeading.textContent = "HỒ SƠ MÁY XƯỞNG";
        els.pageSubtitle.textContent = "Hệ thống lưu giữ thông tin hồ sơ thiết bị, thời hạn bảo hành của toàn xưởng.";
      } else if(pageId === "maintenanceJobsPage") {
        els.pageHeading.textContent = "KẾ HOẠCH BẢO TRÌ CMMS";
        els.pageSubtitle.textContent = "Tổ chức kế hoạch theo từng thiết bị, với chu kỳ, người phụ trách và checklist công việc rõ ràng.";
      } else {
        els.pageHeading.textContent = "NHẬT KÝ SỰ CỐ";
        els.pageSubtitle.textContent = "Theo dõi sự cố đột xuất cơ điện xưởng và phương án xử lý thực tế.";
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function itemStatus(item) {
      if (item.quantity <= 0) return "out";
      if (item.quantity <= item.min) return "low";
      return "ok";
    }

    function render() {
      const current = els.categoryFilter.value || "all";
      const categories = [...new Set(items.map(i => i.category))].sort((a, b) => a.localeCompare(b, "vi"));
      els.categoryFilter.innerHTML = `<option value="all">Tất cả</option>${categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("")}`;
      els.categoryFilter.value = categories.includes(current) ? current : "all";

      els.statItems.textContent = number.format(items.length);
      els.statUnits.textContent = number.format(items.reduce((sum, i) => sum + i.quantity, 0));
      els.statValue.textContent = number.format(new Set(items.map(i => i.location).filter(Boolean)).size);
      els.statLow.textContent = number.format(items.filter(i => itemStatus(i) !== "ok").length);

      // Cập nhật stats CNC
      els.statCncTotal.textContent = number.format(cncs.length);
      els.statCncRunning.textContent = number.format(cncs.filter(c => cncDisplayState(c).status === "running").length);
      els.statCncHold.textContent = number.format(cncs.filter(c => cncDisplayState(c).status === "hold").length);
      els.statCncAlarm.textContent = number.format(cncs.filter(c => cncDisplayState(c).status === "alarm").length);

      updateOverviewQuickStats();
      renderInventoryTable();
      renderMovementHistory();
      renderMachineTable();
      renderCncTable();
      renderMaintenanceJobsTable();
      renderHistoryTable();
      renderAuditHistory();
      renderAlertsAndActivities();
      updateMachineSelectOptions();
    }

    function renderAuditHistory() {
      if (role() !== "admin") return;
      const deviceRows = [...deviceHistory].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
      const accountRows = [...accountHistory].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 12);
      els.deviceHistoryList.innerHTML = deviceRows.length ? deviceRows.map(row => `<tr><td>${formatDateDisplay(row.at)} ${new Date(row.at).toLocaleTimeString("vi-VN")}</td><td>${escapeHtml(row.device || "-")}</td><td>${escapeHtml(row.action || "-")}</td><td>${escapeHtml(row.actor || "-")}</td></tr>`).join("") : `<tr><td colspan="4" class="empty">Chưa có thao tác thiết bị.</td></tr>`;
      els.accountHistoryList.innerHTML = accountRows.length ? accountRows.map(row => `<tr><td>${formatDateDisplay(row.at)} ${new Date(row.at).toLocaleTimeString("vi-VN")}</td><td>${escapeHtml(row.email || "-")}</td><td>${escapeHtml(row.action || "-")}</td></tr>`).join("") : `<tr><td colspan="3" class="empty">Chưa có lịch sử truy cập.</td></tr>`;
      if (els.cncConnectionReady) els.cncConnectionReady.textContent = `${cncs.filter(c => cncIsFresh(c)).length} / ${cncs.length}`;
    }

    async function toggleAdminAudit() {
      if (role() !== "admin") return;
      adminAuditOpen = !adminAuditOpen;
      els.adminAuditPanel.hidden = !adminAuditOpen;
      els.toggleAdminAuditBtn.textContent = adminAuditOpen ? "Ẩn lịch sử quản trị" : "Xem lịch sử quản trị";
      if (!adminAuditOpen) return;

      els.toggleAdminAuditBtn.disabled = true;
      els.toggleAdminAuditBtn.textContent = "Đang tải lịch sử...";
      try {
        const [cloudDeviceHistory, cloudAccountHistory] = await Promise.all([fbFetch("deviceHistory"), fbFetch("accountHistory")]);
        deviceHistory = cloudDeviceHistory ? Object.values(cloudDeviceHistory) : [];
        accountHistory = cloudAccountHistory ? Object.values(cloudAccountHistory).flatMap(entries => Object.values(entries || {})) : [];
        renderAuditHistory();
      } catch (error) {
        adminAuditOpen = false;
        els.adminAuditPanel.hidden = true;
        showToast("Không tải được nhật ký quản trị. Hãy kiểm tra Firebase Rules.");
      } finally {
        els.toggleAdminAuditBtn.disabled = false;
        els.toggleAdminAuditBtn.textContent = adminAuditOpen ? "Ẩn lịch sử quản trị" : "Xem lịch sử quản trị";
      }
    }

    const textViewerCache = new Map();
    const PLACEHOLDER_IMG = `data:image/svg+xml,%3Csvg xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22 width%3D%2244%22 height%3D%2244%22 viewBox%3D%220 0 44 44%22%3E%3Crect width%3D%2244%22 height%3D%2244%22 rx%3D%226%22 fill%3D%22%23eef4f0%22%2F%3E%3Cpath d%3D%22M12 30l7-8 5 5 4-5 6 8H12z%22 fill%3D%22%2390a49a%22%2F%3E%3Ccircle cx%3D%2217%22 cy%3D%2216%22 r%3D%223%22 fill%3D%22%2390a49a%22%2F%3E%3C%2Fsvg%3E`;

    function textEllipsisCell(text, title = "Chi tiết nội dung", extraClass = "") {
      const val = String(text ?? "").trim();
      const cls = extraClass ? `cell-ellipsis ${extraClass}` : "cell-ellipsis";
      if (!val || val === "-") return `<span class="cell-ellipsis static">-</span>`;
      const key = crypto.randomUUID();
      textViewerCache.set(key, { title, body: val });
      return `<button type="button" class="${cls}" data-text-key="${key}" title="Nhấp để xem đầy đủ">${escapeHtml(val)}</button>`;
    }

    function imageThumbCell(imageSrc, entityId, type = "item") {
      const raw = String(imageSrc || "").trim();
      const isSafeImage = raw && !/[<>"'\s]/.test(raw) && /^(data:image\/|https?:\/\/|\.\/|\.\.\/|[\w\-.\/]+\.(png|jpe?g|gif|webp|svg)(\?.*)?$)/i.test(raw);
      if (!isSafeImage) return "";
      return `<img src="${escapeHtml(raw)}" class="table-thumb" data-img-entity="${escapeHtml(entityId)}" data-img-type="${escapeHtml(type)}" alt="Ảnh sản phẩm" title="Xem ảnh lớn" loading="lazy" onerror="this.remove()">`;
    }

    function getAlarmKeyword(alarmCode) {
      const code = String(alarmCode || "");
      if (code.includes("SV")) return "Servo";
      if (code.includes("SP")) return "Spindle";
      if (code.includes("OT")) return "Cảm biến";
      return "Nguồn";
    }

    function updateOverviewQuickStats() {
      const todayStr = new Date().toISOString().slice(0, 10);
      const overviewCncTotal = document.querySelector("#overviewCncTotal");
      const overviewCncRun = document.querySelector("#overviewCncRun");
      const overviewCncHold = document.querySelector("#overviewCncHold");
      const overviewCncAlarm = document.querySelector("#overviewCncAlarm");
      const overviewMachineTotal = document.querySelector("#overviewMachineTotal");
      const overviewJobOverdue = document.querySelector("#overviewJobOverdue");

      if (overviewCncTotal) overviewCncTotal.textContent = number.format(cncs.length);
      if (overviewCncRun) overviewCncRun.textContent = number.format(cncs.filter(c => cncDisplayState(c).status === "running").length);
      if (overviewCncHold) overviewCncHold.textContent = number.format(cncs.filter(c => cncDisplayState(c).status === "hold").length);
      if (overviewCncAlarm) overviewCncAlarm.textContent = number.format(cncs.filter(c => cncDisplayState(c).status === "alarm").length);
      if (overviewMachineTotal) overviewMachineTotal.textContent = number.format(machines.length);
      if (overviewJobOverdue) overviewJobOverdue.textContent = number.format(maintenanceJobs.filter(j => j.nextDate && j.nextDate <= todayStr).length);
    }

    function renderInventoryTable() {
      const term = els.searchInput.value.trim().toLowerCase();
      const skuTerm = els.skuSearchInput.value.trim().toLowerCase();
      const cat = els.categoryFilter.value;
      const stat = els.statusFilter.value;

      const rows = items.filter(i => {
        const h = [i.name, i.sku, i.supplier, i.location, i.specs || '', i.note || ''].join(" ").toLowerCase();
        return (!term || h.includes(term)) && (!skuTerm || String(i.sku ?? "").toLowerCase().includes(skuTerm)) && (cat === "all" || i.category === cat) && (stat === "all" || itemStatus(i) === stat);
      }).sort((a, b) => a.name.localeCompare(b.name, "vi"));

      els.resultCount.textContent = `${rows.length} linh kiện`;
      if (!rows.length) {
        els.inventoryBody.innerHTML = `<tr><td colspan="11" class="empty">Không có linh kiện nào phù hợp với bộ lọc tìm kiếm.</td></tr>`;
        return;
      }

      els.inventoryBody.innerHTML = rows.map(item => {
        const s = itemStatus(item);
        const lbl = { ok: "Đủ dùng", low: "Sắp hết", out: "Hết linh kiện" }[s];
        const cls = { ok: "ok", low: "warn", out: "danger" }[s];
        
        const displayImage = item.image || "";

        return `<tr>
          <td class="col-text-wide">${textEllipsisCell(item.name, "Tên linh kiện", "strong-text")}<div class="sku">${escapeHtml(item.sku)}</div></td>
          <td class="col-text">${textEllipsisCell(item.category, "Nhóm linh kiện")}</td>
          <td class="col-text-wide">${textEllipsisCell(item.specs, "Thông số kỹ thuật", "muted-text-cell")}</td>
          <td><strong>${number.format(item.quantity)}</strong></td>
          <td>${number.format(item.min)}</td>
          <td class="col-text">${textEllipsisCell(item.location || "-", "Vị trí kệ", "brand-text-cell")}</td>
          <td class="col-text">${textEllipsisCell(item.supplier, "Thiết bị dùng", "muted-text-cell")}</td>
          <td class="col-img">${imageThumbCell(displayImage, item.id, "item")}</td>
          <td class="col-text-wide">${textEllipsisCell(item.note, "Ghi chú linh kiện", "muted-text-cell")}</td>
          <td><span class="pill ${cls}">${lbl}</span></td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" type="button" onclick="openMoveDialog('${item.id}')" title="Nhập / Xuất kho">${plusMinusIcon}</button>
              <button class="icon-btn" type="button" onclick="openItemDialog('${item.id}')" title="Sửa thông tin">${editIcon}</button>
              <button class="icon-btn danger" type="button" onclick="deleteItem('${item.id}')" title="Xóa">${deleteIcon}</button>
            </div>
          </td>
        </tr>`;
      }).join("");
    }

    function renderMovementHistory() {
      const rows = [...stockMovements].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 100);
      if (!rows.length) {
        els.movementHistoryList.innerHTML = `<tr><td colspan="8" class="empty">Chưa phát sinh giao dịch nhập hoặc xuất linh kiện.</td></tr>`;
        return;
      }
      els.movementHistoryList.innerHTML = rows.map(m => {
        const typeLabel = m.type === "in" ? "Nhập kho" : "Xuất kho";
        const typeClass = m.type === "in" ? "ok" : "warn";
        return `<tr><td><strong>${formatDateDisplay(m.at)}</strong><div class="meta">${new Date(m.at).toLocaleTimeString("vi-VN")}</div></td><td><span class="pill ${typeClass}">${typeLabel}</span></td><td><strong>${escapeHtml(m.itemName || "-")}</strong><div class="meta">${escapeHtml(m.sku || "")}</div></td><td><strong>${m.amount}</strong></td><td>${m.beforeQuantity} / <strong>${m.afterQuantity}</strong></td><td class="col-text-wide">${textEllipsisCell(m.note || "-", "Lý do giao dịch")}</td><td>${escapeHtml(m.actor || "-")}</td><td><button class="btn" type="button" onclick="exportMovementVoucher('${m.id}')">In phiếu</button></td></tr>`;
      }).join("");
    }

    function renderMachineTable() {
      const term = els.machineSearchInput.value.trim().toLowerCase();
      const rows = machines.filter(m => {
        return !term || [m.name, m.model, m.serial, m.vendor].join(" ").toLowerCase().includes(term);
      }).sort((a,b) => a.name.localeCompare(b.name, "vi"));

      if(!rows.length) {
          els.machineListBody.innerHTML = `<tr><td colspan="8" class="empty">Không tìm thấy máy thiết bị cơ điện nào trong cơ sở dữ liệu.</td></tr>`;
        return;
      }

      els.machineListBody.innerHTML = rows.map(m => `<tr>
        <td class="machine-text-cell">${textEllipsisCell(`⚙️ ${m.name}`, "Tên máy thiết bị", "brand-text-cell")}</td>
        <td class="machine-text-cell">${textEllipsisCell(m.model || "-", "Model máy", "muted-text-cell")}</td>
        <td class="machine-text-cell">${textEllipsisCell(m.serial || "-", "Số Serial", "muted-text-cell")}</td>
        <td><strong>${formatDateDisplay(m.setupDate)}</strong></td>
        <td><strong>${formatDateDisplay(m.warranty)}</strong></td>
        <td class="machine-text-cell">${textEllipsisCell(m.vendor, "Công ty cung cấp", "muted-text-cell")}</td>
        <td class="machine-text-cell">${textEllipsisCell(m.phone ? `📞 ${m.phone}` : "", "Số điện thoại", "brand-text-cell")}</td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" type="button" onclick="openMachineDialog('${m.id}')" title="Chỉnh sửa">${editIcon}</button>
            <button class="icon-btn danger" type="button" onclick="deleteMachine('${m.id}')" title="Xóa hồ sơ máy">${deleteIcon}</button>
          </div>
        </td>
      </tr>`).join("");
    }

    // VẼ BẢNG GIÁM SÁT MÁY CNC REALTIME & TỔNG QUAN ALARM
    function renderCncTable() {
      if (els.cncConnectionReady) els.cncConnectionReady.textContent = `${cncs.filter(c => cncIsFresh(c)).length} / ${cncs.length}`;
      renderCncGridOnly();
      renderCncAlarmsOnly();
    }

    function renderCncGridOnly() {
      const term = els.cncSearchInput.value.trim().toLowerCase();
      const filteredCncs = cncs.filter(c => {
        return !term || [c.name, c.ip, c.model, c.location].join(" ").toLowerCase().includes(term);
      });

      if (filteredCncs.length === 0) {
        document.querySelector("#cncListGrid").innerHTML = `<div class="empty" style="grid-column: 1/-1;">Chưa có máy phù hợp. Máy mới chỉ có dữ liệu thật sau khi chạy cầu nối.</div>`;
        return;
      }

      document.querySelector("#cncListGrid").innerHTML = filteredCncs.map(c => {
        const signal = cncDisplayState(c);
        const statusText = signal.label;
        const statusClass = signal.css;
        const showTelemetry = cncIsFresh(c) || c.source === "demo";
        const sourceLabel = c.source === "focas" ? "Dữ liệu thật · FOCAS" : c.source === "demo" ? "Dữ liệu mô phỏng" : "Chưa xác minh nguồn dữ liệu";
        // Tìm kiếm tự động linh kiện khắc phục lỗi trong kho LTD tương ứng với loại alarm
        let matchedPartInfo = "";
        if (c.source !== "focas" && signal.status === "alarm" && c.alarm) {
          matchedPartInfo = checkAvailablePartsInInventory(c.alarm);
        }
        const lastSignal = c.lastSeen ? `${formatDateDisplay(c.lastSeen)} ${new Date(c.lastSeen).toLocaleTimeString("vi-VN")}` : "Chờ tín hiệu đầu tiên";

        return `
          <div class="cnc-card" id="card-${c.id}">
            <div class="cnc-header">
              <span class="cnc-title">💻 ${escapeHtml(c.name)}</span>
              <span class="cnc-status ${statusClass}"><span class="cnc-state-light ${statusClass}" aria-hidden="true"></span>${statusText}</span>
            </div>
            <div style="display:flex; justify-content:space-between; gap:12px; padding:8px 0 12px; color:var(--muted); font-size:11px; border-bottom:1px solid var(--line);">
              <span><strong style="color:var(--ink)">FOCAS endpoint</strong> · ${escapeHtml(c.ip)}:${c.port}</span>
              <span><strong style="color:var(--ink)">${sourceLabel}</strong> · ${escapeHtml(lastSignal)}</span>
            </div>
            
            <div class="cnc-details">
              ${c.source === "focas" ? `<span class="cnc-label">Chế độ vận hành:</span><span class="cnc-value">${showTelemetry ? cncMode(c.rawStatus?.aut) : "—"}</span><span class="cnc-label">Alarm:</span><span class="cnc-value">${showTelemetry ? (c.rawStatus?.alarm === 0 ? "Không có alarm" : "Có tín hiệu alarm") : "—"}</span>` : ""}
              <span class="cnc-label">Model CNC:</span>
              <span class="cnc-value">${escapeHtml(c.model)}</span>
              
              <span class="cnc-label">Chương trình hiện tại:</span>
              <span class="cnc-value" style="color: var(--accent); font-weight:800;">${escapeHtml(showTelemetry ? c.activeProgram || "Chưa đọc" : "—")}</span>
              
              ${c.source === "focas" ? `<span class="cnc-label">Chương trình chính:</span><span class="cnc-value">${escapeHtml(showTelemetry ? c.mainProgram || "Chưa đọc" : "—")}</span>` : ""}
              <span class="cnc-label">Dòng lệnh hiện tại:</span>
              <span class="cnc-value" style="font-size:12px; font-weight: 500">${escapeHtml(showTelemetry ? c.currentBlock || "Chưa đọc" : "—")}</span>
              
              <span class="cnc-label">Vòng quay trục chính:</span>
              <span class="cnc-value" style="color: var(--ok)">${showTelemetry ? cncMeasurement(c.spindleSpeed) : "—"} RPM${c.source !== "focas" && showTelemetry ? ` / ${cncMeasurement(c.targetSpindleSpeed)} đặt` : ""}</span>
              
              <span class="cnc-label">Tốc độ ăn dao (Feedrate):</span>
              <span class="cnc-value">${showTelemetry ? cncMeasurement(c.feedrate) : "—"} ${escapeHtml(c.source === "focas" ? c.feedrateUnit || "" : "mm/min")}${c.source !== "focas" && showTelemetry ? ` (Ovr: ${cncMeasurement(c.override)}%)` : ""}</span>
              
              ${c.source === "focas" ? `<span class="cnc-label">PART COUNT:</span><span class="cnc-value">${showTelemetry ? cncMeasurement(c.partCounter) : "—"}</span>` : ""}
              ${c.source === "focas" ? `<span class="cnc-label">RUN TIME:</span><span class="cnc-value">${showTelemetry ? cncDuration(c.runTimeMs) : "—"}</span><span class="cnc-label">CYCLE TIME:</span><span class="cnc-value">${showTelemetry ? cncDuration(c.cycleTimeMs) : "—"}</span>` : ""}
            </div>

            ${signal.status === "alarm" ? `
              <div class="cnc-alarm-banner">
                <strong style="color: var(--danger); font-size:13px;">⚠️ PHÁT HIỆN LỖI CNC:</strong>
                <span class="cnc-value" style="color: var(--danger); font-size:12px; font-weight:bold;">${escapeHtml(c.alarm)}</span>
              </div>
              ${matchedPartInfo}
            ` : ''}

            ${showTelemetry && c.readErrors && Object.keys(c.readErrors).length ? `<div class="meta" role="status">Một số mục chưa đọc được: ${escapeHtml(Object.values(c.readErrors).join("; "))}</div>` : ""}
            <div class="row-actions" style="margin-top:auto; border-top:1px solid var(--line); padding-top:10px;">
              <button class="btn" style="min-height:30px; font-size:12px;" onclick="openCncMachineAlarmHistory('${c.id}')">Lịch sử lỗi</button>
              <button class="btn" style="min-height:30px; font-size:12px;" onclick="openCncDialog('${c.id}')">Sửa IP</button>
              ${c.source !== "focas" && signal.status === "alarm" ? `
                <button class="btn primary" style="min-height:30px; font-size:12px; background:var(--ok); border-color:var(--ok)" onclick="resolveCncAlarm('${c.id}')">Xử lý xong (Clear)</button>
              ` : ''}
              <button class="icon-btn danger" onclick="deleteCnc('${c.id}')">${deleteIcon}</button>
            </div>
          </div>
        `;
      }).join("");
    }

    // LIÊN KẾT THÔNG MINH ALARM CNC VỚI KHO LINH KIỆN LTD
    function checkAvailablePartsInInventory(alarmText) {
      let keyword = "";
      let categoryNeeded = "";
      
      // Phân tích mã alarm để tìm linh kiện phù hợp
      if (alarmText.includes("SV") || alarmText.includes("SERVO")) {
        keyword = "Servo";
        categoryNeeded = "Driver hoặc Động cơ Servo";
      } else if (alarmText.includes("SP") || alarmText.includes("SPINDLE") || alarmText.includes("TRỤC CHÍNH")) {
        keyword = "Spindle";
        categoryNeeded = "Biến tần hoặc Động cơ";
      } else if (alarmText.includes("OT") || alarmText.includes("LIMIT") || alarmText.includes("HÀNH TRÌNH")) {
        keyword = "Cảm biến";
        categoryNeeded = "Công tắc hành trình hoặc Cảm biến";
      } else {
        keyword = "Nguồn";
        categoryNeeded = "Thiết bị điện điều khiển";
      }

      // Quét kho LTD tìm kiếm linh kiện khớp tên
      const matchedPart = items.find(i => i.name.toLowerCase().includes(keyword.toLowerCase()) || i.category.toLowerCase().includes(keyword.toLowerCase()));

      if (matchedPart) {
        const isAvailable = matchedPart.quantity > 0;
        const statusClass = isAvailable ? "instock" : "outofstock";
        const statusText = isAvailable ? `Còn hàng trong kho (${matchedPart.quantity} cái) tại Kệ ${matchedPart.location}` : "Hết hàng - Yêu cầu mua khẩn cấp";
        
        return `
          <div class="cnc-parts-link">
            <strong>🛠️ Linh kiện đối chiếu kho LTD:</strong>
            <div style="margin-top:4px;">Tên LK: <strong style="color:var(--brand)">${escapeHtml(matchedPart.name)}</strong> (${escapeHtml(matchedPart.sku)})</div>
            <div style="margin-top:2px;">
              Trạng thái LTD: 
              <span class="part-status ${statusClass}">${statusText}</span>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="cnc-parts-link">
            <strong>🛠️ Đề xuất vật tư bảo trì:</strong>
            <div style="margin-top:4px; color:var(--muted)">Chưa tìm thấy linh kiện khớp chuẩn cho lỗi này trong kho LTD.</div>
            <div style="margin-top:2px; font-weight:bold;">Yêu cầu: <span class="part-status outofstock">${categoryNeeded}</span></div>
          </div>
        `;
      }
    }

    function renderCncAlarmsOnly() {
      const alarmList = cncAlarmHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      document.querySelector("#cncAlarmCount").textContent = `${alarmList.length} sự cố`;

      if (alarmList.length === 0) {
        document.querySelector("#cncAlarmHistoryBody").innerHTML = `<tr><td colspan="7" class="empty">Chưa ghi nhận lịch sử lỗi máy CNC nào từ hệ FOCAS kết nối.</td></tr>`;
        return;
      }

      document.querySelector("#cncAlarmHistoryBody").innerHTML = alarmList.map(a => {
        let matchedPartInfo = "-";
        
        // Quét kho LTD xem có linh kiện khắc phục không
        let keyword = getAlarmKeyword(a.alarmCode);

        const matchedPart = items.find(i => i.name.toLowerCase().includes(keyword.toLowerCase()));
        if (matchedPart) {
          const isAvail = matchedPart.quantity > 0;
          const labelColor = isAvail ? "var(--ok)" : "var(--danger)";
          const labelText = isAvail ? `CÒN HÀNG (Kệ ${matchedPart.location})` : "HẾT HÀNG";
          matchedPartInfo = `<strong style="color: ${labelColor}">${escapeHtml(matchedPart.name)}</strong><br><span style="font-size:11px; font-weight:700; color:${labelColor}">● ${labelText}</span>`;
        } else {
          matchedPartInfo = `<span style="color:var(--muted)">Cần nhập: ${keyword}</span>`;
        }

        return `
          <tr>
            <td><strong>${formatDateDisplay(a.timestamp)}</strong><div style="font-size:11px; color:var(--muted)">${new Date(a.timestamp).toLocaleTimeString("vi-VN")}</div></td>
            <td><strong>${escapeHtml(a.cncName)}</strong></td>
            <td><span class="pill danger" style="font-size:11px; font-family:monospace">${escapeHtml(a.alarmCode)}</span></td>
            <td class="col-text-wide">${textEllipsisCell(a.description, "Mô tả chi tiết lỗi CNC")}</td>
            <td><strong>${keyword}</strong></td>
            <td>${matchedPartInfo}</td>
            <td>
              <div class="row-actions">
                <button class="btn" style="min-height:28px; font-size:11px; padding:0 8px; background:var(--brand); color:#fff; border:0" onclick="autoCreateRepairHistoryFromCncAlarm('${a.id}')">Tạo Nhật ký sửa máy</button>
              </div>
            </td>
          </tr>
        `;
      }).join("");
    }

    function openCncMachineAlarmHistory(cncId) {
      const c = cncs.find(x => x.id === cncId);
      if (!c) return;
      cncAlarmHistoryViewId = cncId;
      els.cncAlarmHistoryTitle.textContent = `Lịch sử lỗi — ${c.name}`;
      els.cncAlarmHistoryMeta.textContent = `IP FOCAS: ${c.ip}:${c.port} · Tổng sự cố: ${cncAlarmHistory.filter(a => a.cncId === cncId).length}`;
      renderCncMachineAlarmHistory(cncId);
      els.cncAlarmHistoryDialog.showModal();
    }

    function renderCncMachineAlarmHistory(cncId) {
      const c = cncs.find(x => x.id === cncId);
      if (c && els.cncAlarmHistoryMeta) {
        els.cncAlarmHistoryMeta.textContent = `IP FOCAS: ${c.ip}:${c.port} · Tổng sự cố: ${cncAlarmHistory.filter(a => a.cncId === cncId).length}`;
      }

      const rows = cncAlarmHistory
        .filter(a => a.cncId === cncId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (!rows.length) {
        els.cncMachineAlarmHistoryBody.innerHTML = `<tr><td colspan="4" class="empty">Chưa ghi nhận lỗi nào cho máy CNC này.</td></tr>`;
        return;
      }

      els.cncMachineAlarmHistoryBody.innerHTML = rows.map(a => {
        const isResolved = Boolean(a.resolvedAt);
        const statusPill = isResolved
          ? `<span class="pill ok">Đã xử lý</span><div class="meta" style="margin-top:4px;">${formatDateDisplay(a.resolvedAt)} ${new Date(a.resolvedAt).toLocaleTimeString("vi-VN")}</div>`
          : `<span class="pill danger">Đang lỗi</span>`;
        return `
          <tr>
            <td>
              <strong>${formatDateDisplay(a.timestamp)}</strong>
              <div class="meta">${new Date(a.timestamp).toLocaleTimeString("vi-VN")}</div>
            </td>
            <td><span class="pill danger" style="font-size:11px; font-family:monospace">${escapeHtml(a.alarmCode)}</span></td>
            <td class="col-text-wide">${textEllipsisCell(a.description, "Mô tả chi tiết lỗi CNC")}</td>
            <td>${statusPill}</td>
          </tr>
        `;
      }).join("");
    }

    function closeCncAlarmHistoryDialog() {
      cncAlarmHistoryViewId = null;
      els.cncAlarmHistoryDialog.close();
    }

    // TỰ ĐỘNG CHUYỂN ALARM CNC THÀNH NHẬT KÝ SỬA CHỮA KHẮC PHỤC SỰ CỐ
    function autoCreateRepairHistoryFromCncAlarm(alarmId) {
      switchPage("historyPage");
      document.querySelectorAll(".nav button").forEach(entry => entry.classList.remove("active"));
      document.querySelector('[data-page="historyPage"]').classList.add("active");
      showToast("Nhật ký sự cố là dữ liệu chỉ đọc. Hệ thống chỉ tự ghi khi hoàn tất bảo trì.");
    }

    // Xóa máy CNC
    async function deleteCnc(id) {
      if (!confirm("Bạn chắc chắn muốn xóa máy CNC này? Hãy dừng cầu nối trước, nếu không bản ghi có thể được tạo lại.")) return;
      cncs = cncs.filter(c => c.id !== id);
      addAct("Xóa máy CNC khỏi hệ thống giám sát.");
      render();
      await Promise.all([fbFetch(`cncs/${id}`, "DELETE"), syncNode("activities", activities)]);
    }

    // Cập nhật hoặc lưu thông tin CNC
    async function saveCnc(e) {
      e.preventDefault();
      const id = els.cncId.value || crypto.randomUUID();
      const payload = {
        id,
        name: els.cncNameInput.value.trim(),
        ip: els.cncIpInput.value.trim(),
        port: Number(els.cncPortInput.value),
        model: els.cncModelInput.value,
        ...(els.cncId.value ? {} : { source: "pending", connected: false, status: "offline" })
      };

      const idx = cncs.findIndex(x => x.id === id);
      if (idx >= 0) {
        cncs[idx] = { ...cncs[idx], ...payload };
        addAct(`Cập nhật thông tin kết nối máy CNC: ${payload.name}`);
      } else {
        cncs.push(payload);
        addAct(`Thêm máy CNC mới kết nối mạng FOCAS: ${payload.name}`);
      }
      closeCncDialog();
      render();
      await Promise.all([fbFetch(`cncs/${id}`, "PATCH", payload), syncNode("activities", activities)]);
    }

    function openCncDialog(id = "") {
      const c = cncs.find(x => x.id === id);
      els.cncTitle.textContent = c ? "Chỉnh sửa kết nối máy CNC" : "Thêm máy CNC mới";
      els.cncId.value = c?.id || "";
      els.cncNameInput.value = c?.name || "";
      els.cncIpInput.value = c?.ip || "";
      els.cncPortInput.value = c?.port || 8193;
      els.cncModelInput.value = c?.model || "Fanuc 0i-F";
      els.cncDialog.showModal();
    }
    function closeCncDialog() { els.cncDialog.close(); els.cncForm.reset(); }

    // XỬ LÝ SỬA XONG ALARM (XÓA LỖI MÁY CNC)
    async function resolveCncAlarm(id) {
      const c = cncs.find(x => x.id === id);
      if (!c) return;
      if (c.source === "focas") { showToast("Alarm máy thật chỉ cập nhật từ tín hiệu CNC; web không xóa lỗi trên máy."); return; }

      cncAlarmHistory.forEach(a => {
        if (a.cncId === id && !a.resolvedAt) a.resolvedAt = new Date().toISOString();
      });

      c.status = "running";
      c.alarm = "";
      c.spindleSpeed = c.targetSpindleSpeed;
      c.feedrate = c.targetFeedrate;
      
      addAct(`Đã xử lý xong (Clear Alarm) cho máy CNC: ${c.name}`);
      render();
      showToast(`Đã xóa lỗi cho máy ${c.name}. Máy trở lại trạng thái Sẵn Sàng (RUN).`);
      await Promise.all([fbFetch(`cncs/${id}`, "PATCH", { status: c.status, alarm: c.alarm, spindleSpeed: c.spindleSpeed ?? null, feedrate: c.feedrate ?? null }), syncNode("cncAlarms", cncAlarmHistory), syncNode("activities", activities)]);

      if (cncAlarmHistoryViewId === id && els.cncAlarmHistoryDialog.open) {
        renderCncMachineAlarmHistory(id);
      }
    }

    const frequencyDetails = {
      daily: { label: "Hằng ngày", months: 0, days: 1 },
      weekly: { label: "Hằng tuần", months: 0, days: 7 },
      monthly: { label: "Hằng tháng", months: 1 },
      quarterly: { label: "Hằng quý", months: 3 },
      semiannual: { label: "6 tháng một lần", months: 6 },
      yearly: { label: "Hằng năm", months: 12 }
    };

    function recurrenceForJob(job) {
      if (frequencyDetails[job.recurrence]) return job.recurrence;
      return ({ 1: "monthly", 3: "quarterly", 6: "semiannual", 12: "yearly" })[Number(job.period)] || "monthly";
    }

    function recurrenceLabel(job) { return frequencyDetails[recurrenceForJob(job)].label; }

    function renderMaintenanceJobsTable() {
      const term = els.jobSearchInput.value.trim().toLowerCase();
      const todayStr = new Date().toISOString().slice(0, 10);
      const visibleMachines = machines.filter(machine => !term || [machine.name, machine.model, machine.serial, machine.vendor, ...maintenanceJobs.filter(j => j.machineId === machine.id).flatMap(j => [j.jobName, j.desc, j.owner])].join(" ").toLowerCase().includes(term));

      if (!visibleMachines.length) {
        els.maintenanceScheduleBoard.innerHTML = `<div class="empty">Chưa có máy nào phù hợp. Hãy thêm máy quản lý hoặc điều chỉnh bộ lọc.</div>`;
        return;
      }

      els.maintenanceScheduleBoard.innerHTML = visibleMachines.map(machine => {
        const jobs = maintenanceJobs.filter(j => j.machineId === machine.id && (!term || [j.jobName, j.desc, j.owner, machine.name].join(" ").toLowerCase().includes(term))).sort((a, b) => String(a.nextDate).localeCompare(String(b.nextDate)));
        const dueCount = jobs.filter(j => j.nextDate && j.nextDate <= todayStr).length;
        const isExpanded = expandedMaintenanceMachineIds.has(machine.id);
        const machineIdentity = [machine.model && `Model: ${machine.model}`, machine.serial && `S/N: ${machine.serial}`].filter(Boolean).join(" · ") || "Chưa cập nhật Model / Serial";
        return `<article class="maintenance-machine ${dueCount ? "has-due" : ""} ${isExpanded ? "is-expanded" : ""}">
          <div class="maintenance-machine-head">
            <button class="maintenance-machine-summary" type="button" onclick="toggleMaintenanceMachine('${machine.id}')" aria-expanded="${isExpanded}">
              <span class="maintenance-machine-name"><strong>${escapeHtml(machine.name)}</strong><small>${escapeHtml(machineIdentity)} · ${jobs.length} hạng mục</small></span>
              <span class="maintenance-machine-state ${dueCount ? "due" : "ok"}">${dueCount ? `Cần bảo trì: ${dueCount}` : "Đúng lịch"}</span>
              <span class="maintenance-machine-chevron" aria-hidden="true">${isExpanded ? "⌃" : "⌄"}</span>
            </button>
            <button class="btn primary maintenance-machine-add" type="button" onclick="openJobDialog('', '${machine.id}')">Thêm hạng mục</button>
          </div>
          <div class="maintenance-machine-jobs" ${isExpanded ? "" : "hidden"}>
          <div class="maintenance-machine-toolbar"><span>${escapeHtml(machine.vendor || "Chưa cập nhật nhà cung cấp")}</span></div>
          ${jobs.length ? jobs.map(job => {
            const due = job.nextDate <= todayStr;
            return `<div class="maintenance-task">
              <div><strong>${escapeHtml(job.jobName)}</strong><small>${escapeHtml(job.desc || "Chưa có checklist kỹ thuật")}</small></div>
              <div><small>Chu kỳ</small><strong>${escapeHtml(recurrenceLabel(job))}</strong></div>
              <div><small>Kỳ kế tiếp</small><strong style="color:${due ? "var(--danger)" : "var(--ok)"}">${formatDateDisplay(job.nextDate)}</strong></div>
              <div><small>Phụ trách</small><strong>${escapeHtml(job.owner || "Chưa phân công")}</strong><small>${escapeHtml(job.estimatedTime || "Chưa có thời lượng")} · Thiết lập: ${escapeHtml(job.createdBy || "Dữ liệu cũ")}</small></div>
              <div class="maintenance-task-actions">
                <button class="icon-btn" type="button" title="Hoàn tất kỳ này" onclick="completeAndRenewJob('${job.id}')">${checkIcon}</button>
                <button class="icon-btn" type="button" title="Sửa lịch" onclick="openJobDialog('${job.id}')">${editIcon}</button>
                <button class="icon-btn danger" type="button" title="Xóa lịch" onclick="deleteJob('${job.id}')">${deleteIcon}</button>
              </div>
            </div>`;
          }).join("") : `<div class="maintenance-empty">Máy này chưa có lịch bảo trì. Chọn “Thêm hạng mục” để tạo kế hoạch đầu tiên.</div>`}
          </div>
        </article>`;
      }).join("");
    }

    function toggleMaintenanceMachine(id) {
      if (expandedMaintenanceMachineIds.has(id)) expandedMaintenanceMachineIds.delete(id);
      else expandedMaintenanceMachineIds.add(id);
      renderMaintenanceJobsTable();
    }

    function renderHistoryTable() {
      const term = els.historySearchInput.value.trim().toLowerCase();
      const fromV = els.historyFromInput.value ? new Date(els.historyFromInput.value) : null;
      const toV = els.historyToInput.value ? new Date(els.historyToInput.value) : null;

      const rows = repairHistory.filter(h => {
        const d = new Date(h.faultTime);
        const hay = [h.machine, h.staff, h.fault, h.fix].join(" ").toLowerCase();
        return (!term || hay.includes(term)) && (!fromV || d >= fromV) && (!toV || d <= toV);
      }).sort((a,b) => new Date(b.faultTime) - new Date(a.faultTime));

      if(!rows.length) {
        els.historyList.innerHTML = `<tr><td colspan="${role() === "admin" ? 7 : 6}" class="empty">Không tìm thấy nhật ký sự cố sửa chữa nào phù hợp.</td></tr>`;
        return;
      }

      els.historyList.innerHTML = rows.map(h => {
        const displayImage = h.image || "";

        return `<tr>
          <td><strong>${formatDateDisplay(h.faultTime)}</strong></td>
          <td class="col-text-wide">${textEllipsisCell(h.machine, "Thiết bị / máy lỗi", "strong-text")}</td>
          <td class="col-text-wide">${textEllipsisCell(`👷 ${h.staff}`, "Kỹ sư xử lý", "brand-text-cell")}</td>
          <td class="col-text-wide">${textEllipsisCell(h.fault, "Mô tả lỗi sự cố", "muted-text-cell")}</td>
          <td class="col-text-wide">${textEllipsisCell(h.fix, "Phương án khắc phục", "muted-text-cell")}</td>
          <td class="col-img">${imageThumbCell(displayImage, h.id, "history")}</td>${role() === "admin" ? `<td><div class="row-actions"><button class="icon-btn" type="button" onclick="openHistoryDialog('${h.id}')" title="Sửa nhật ký sự cố">${editIcon}</button><button class="icon-btn danger" type="button" onclick="deleteHistory('${h.id}')" title="Xóa nhật ký sự cố">${deleteIcon}</button></div></td>` : ""}
        </tr>`;
      }).join("");
    }

    function updateMachineSelectOptions() {
      const currentSelection = els.jMachineSelect.value;
      els.jMachineSelect.innerHTML = `<option value="">-- Vui lòng chọn máy xưởng --</option>` + 
        machines.map(m => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.name)}</option>`).join("");
      els.jMachineSelect.value = currentSelection;
    }

    // Modal phóng to xem ảnh & nội dung dài
    const imageViewerDialog = document.querySelector("#imageViewerDialog");
    const fullSizeImage = document.querySelector("#fullSizeImage");
    const textViewerDialog = document.querySelector("#textViewerDialog");
    const textViewerTitle = document.querySelector("#textViewerTitle");
    const textViewerBody = document.querySelector("#textViewerBody");

    function openImageViewer(src) {
      if (!src) return;
      fullSizeImage.src = src;
      imageViewerDialog.showModal();
    }

    function openTextViewer(title, body) {
      textViewerTitle.textContent = title || "Chi tiết nội dung";
      textViewerBody.textContent = body || "-";
      textViewerDialog.showModal();
    }

    function closeTextViewer() {
      textViewerDialog.close();
    }

    document.addEventListener("click", (e) => {
      const textBtn = e.target.closest("[data-text-key]");
      if (textBtn) {
        const data = textViewerCache.get(textBtn.dataset.textKey);
        if (data) openTextViewer(data.title, data.body);
        return;
      }
      const thumb = e.target.closest(".table-thumb[data-img-entity]");
      if (thumb) {
        const id = thumb.dataset.imgEntity;
        const type = thumb.dataset.imgType;
        let src = thumb.getAttribute("src");
        if (type === "item") {
          const item = items.find(i => i.id === id);
          if (item?.image) src = item.image;
        } else if (type === "history") {
          const h = repairHistory.find(x => x.id === id);
          if (h?.image) src = h.image;
        }
        openImageViewer(src);
      }
    });

    document.querySelector("#closeImageViewerBtn").addEventListener("click", () => {
      imageViewerDialog.close();
    });
    document.querySelector("#closeTextViewerBtn").addEventListener("click", closeTextViewer);
    document.querySelector("#closeTextViewerFootBtn").addEventListener("click", closeTextViewer);

    function renderAlertsAndActivities() {
      let alertHtml = "";
      const todayStr = new Date().toISOString().slice(0, 10);

      // 1. Quét kỳ hạn bảo trì đến hạn từ Job
      maintenanceJobs.forEach(j => {
        if (j.nextDate && j.nextDate <= todayStr) {
          alertHtml += `
            <div class="alert-item" style="border-left: 4px solid var(--danger); background: #fff8f8;">
              <strong style="color: var(--danger); display: flex; align-items: center; gap: 6px;">
                <span>🚨 ĐẾN HẠN BẢO TRÌ</span>
              </strong>
              <div style="font-weight:800; margin-top:2px; font-size:13.5px;">Thiết bị: ${escapeHtml(j.machineName)}</div>
              <div style="font-size:12.5px; font-weight:600; color:var(--brand);">Hạng mục: ${escapeHtml(j.jobName)}</div>
              <div class="meta">Hạn dự kiến: ${formatDateDisplay(j.nextDate)}. Chu kỳ: ${recurrenceLabel(j)}.</div>
            </div>
          `;
        }
      });

      // 2. Quét máy CNC đang trong trạng thái Alarm
      cncs.forEach(c => {
        if (cncDisplayState(c).status === "alarm") {
          alertHtml += `
            <div class="alert-item" style="border-left: 4px solid var(--danger); background: #fff8f8;">
              <strong style="color: var(--danger)">🚨 CNC ALARM (FANUC IoT)</strong>
              <div style="font-weight:800; margin-top:2px;">${escapeHtml(c.name)}</div>
              <div style="font-size:12px; color: var(--danger); font-family: monospace;">${escapeHtml(c.alarm)}</div>
              <div class="meta">IP: ${escapeHtml(c.ip)}. Hãy kiểm tra thông báo trực tiếp trên CNC.</div>
            </div>
          `;
        }
      });

      // 3. Quét linh kiện sắp hết / hết hàng
      const alerts = items.filter(i => itemStatus(i) !== "ok").sort((a,b)=>a.quantity-b.quantity);
      alerts.forEach(i => {
        const currentStat = itemStatus(i);
        const badgeCls = currentStat === 'low' ? 'warn' : 'danger';
        const badgeText = currentStat === 'low' ? 'Sắp hết hàng' : 'Hết linh kiện';
        alertHtml += `
          <div class="alert-item" style="border-left: 4px solid ${currentStat === 'low' ? 'var(--warn)' : 'var(--danger)'};">
            <strong style="color: #0f241d;">${escapeHtml(i.name)}</strong>
            <div><span class="pill ${badgeCls}">${badgeText}</span></div>
            <div class="meta">Kho thực tế: <strong>${i.quantity}</strong> / Tối thiểu: ${i.min}. Kệ: <strong>${escapeHtml(i.location || "-")}</strong></div>
          </div>
        `;
      });

      els.alertList.innerHTML = alertHtml ? alertHtml : `<div class="empty">Hệ thống ghi nhận không có cảnh báo nào về linh kiện hay lịch bảo trì máy.</div>`;

      els.activityList.innerHTML = activities.slice(0,5).map(a => `
        <div class="activity-item">
          <strong>⚡ ${escapeHtml(a.text)}</strong>
          <div class="meta">${new Intl.DateTimeFormat("vi-VN", {hour:"2-digit", minute:"2-digit", second:"2-digit"}).format(new Date(a.at))}</div>
        </div>
      `).join("");
    }

    // HỘP THOẠI LINH KIỆN
    function openItemDialog(id = "") {
      const item = items.find(i => i.id === id);
      els.dialogTitle.textContent = item ? "Sửa thông tin linh kiện" : "Thêm linh kiện mới";
      els.itemId.value = item?.id || "";
      els.nameInput.value = item?.name || "";
      els.skuInput.value = item?.sku || "";
      els.categoryInput.value = item?.category || "";
      els.supplierInput.value = item?.supplier || "";
      els.quantityInput.value = item?.quantity ?? 0;
      els.minInput.value = item?.min ?? 0;
      els.priceInput.value = item?.price ?? 0;
      els.locationInput.value = item?.location || "";
      els.specsInput.value = item?.specs || "";
      els.noteInput.value = item?.note || "";
      els.itemImageInput.value = "";
      
      if (item && item.image) {
        els.itemImageDataHidden.value = item.image;
        els.itemImagePreview.src = item.image;
        els.itemImagePreviewWrap.style.display = "block";
      } else {
        els.itemImageDataHidden.value = "";
        els.itemImagePreview.src = "";
        els.itemImagePreviewWrap.style.display = "none";
      }
      els.itemDialog.showModal();
    }
    
    function closeItemDialog() { els.itemDialog.close(); els.itemForm.reset(); }
    
    async function saveItem(e) {
      e.preventDefault();
      const id = els.itemId.value || crypto.randomUUID();
      const payload = {
        id, name: els.nameInput.value.trim(), sku: els.skuInput.value.trim().toUpperCase(),
        category: els.categoryInput.value.trim(), supplier: els.supplierInput.value.trim(),
        quantity: Number(els.quantityInput.value), min: Number(els.minInput.value),
        price: Number(els.priceInput.value), location: els.locationInput.value.trim(), 
        specs: els.specsInput.value.trim(), note: els.noteInput.value.trim(),
        image: els.itemImageDataHidden.value || ""
      };
      const idx = items.findIndex(i => i.id === id);
      if(idx >= 0) { items[idx] = payload; addAct(`Đã sửa linh kiện: ${payload.name}`); }
      else { items.push(payload); addAct(`Đã thêm mới linh kiện: ${payload.name}`); }
      closeItemDialog(); render();
      await Promise.all([syncNode("items", items), syncNode("activities", activities)]);
    }

    async function deleteItem(id) {
      if(!confirm("Hệ thống sẽ xóa mã linh kiện này khỏi cơ sở dữ liệu vĩnh viễn. Bạn chắc chắn muốn xóa?")) return;
      const iName = items.find(i => i.id === id)?.name || "Linh kiện";
      items = items.filter(i => i.id !== id);
      addAct(`Xóa linh kiện: ${iName}`); render();
      await Promise.all([fbFetch(`items/${id}`, "DELETE"), syncNode("activities", activities)]);
    }

    // NHẬP XUẤT KHO NHANH
    function openMoveDialog(id) {
      const item = items.find(i => i.id === id); if(!item) return;
      els.moveItemId.value = id; els.moveTitle.textContent = `Nhập / Xuất kho nhanh: ${item.name}`;
      els.moveDialog.showModal();
    }
    function closeMoveDialog() { els.moveDialog.close(); els.moveForm.reset(); }
    
    async function saveMovement(e) {
      e.preventDefault();
      const item = items.find(i => i.id === els.moveItemId.value); if(!item) return;
      const amt = Number(els.moveAmount.value);
      if(els.moveType.value === "out" && amt > item.quantity) { 
        alert("Lỗi: Số lượng xuất kho vượt quá lượng tồn thực tế đang có!"); 
        return; 
      }
      const type = els.moveType.value;
      const beforeQuantity = item.quantity;
      item.quantity += (type === "in" ? amt : -amt);
      const movement = {
        id: crypto.randomUUID(), itemId: item.id, itemName: item.name, sku: item.sku || "",
        type, amount: amt, beforeQuantity, afterQuantity: item.quantity,
        note: els.moveNote.value.trim(), actor: displayName(), at: new Date().toISOString()
      };
      stockMovements.unshift(movement);
      addAct(`${type === 'in' ? 'Nhập kho thêm' : 'Xuất kho dùng'} ${amt} chiếc ${item.name}`);
      closeMoveDialog(); render();
      await Promise.all([syncNode("items", items), fbFetch(`stockMovements/${movement.id}`, "PUT", movement), syncNode("activities", activities)]);
    }

    // MÁY MÓC NHÀ XƯỞNG
    function openMachineDialog(id = "") {
      const m = machines.find(x => x.id === id);
      els.machineTitle.textContent = m ? "Sửa thông tin máy móc" : "Thêm máy thiết bị mới";
      els.mId.value = m?.id || "";
      els.mName.value = m?.name || "";
      els.mModel.value = m?.model || "";
      els.mSerial.value = m?.serial || "";
      els.mSetupDate.value = m?.setupDate || new Date().toISOString().slice(0,10);
      els.mWarranty.value = m?.warranty || new Date().toISOString().slice(0,10);
      els.mVendor.value = m?.vendor || "";
      els.mPhone.value = m?.phone || "";
      els.machineDialog.showModal();
    }
    function closeMachineDialog() { els.machineDialog.close(); els.machineForm.reset(); }
    
    async function saveMachine(e) {
      e.preventDefault();
      const id = els.mId.value || crypto.randomUUID();
      const payload = {
        id, name: els.mName.value.trim(), model: els.mModel.value.trim(), serial: els.mSerial.value.trim(), setupDate: els.mSetupDate.value,
        warranty: els.mWarranty.value, vendor: els.mVendor.value.trim(), phone: els.mPhone.value.trim()
      };
      const idx = machines.findIndex(x => x.id === id);
      if(idx >= 0) { 
        machines[idx] = payload; 
        addAct(`Cập nhật máy xưởng: ${payload.name}`);
        maintenanceJobs.forEach(j => { if(j.machineId === id) j.machineName = payload.name; });
      } else { 
        machines.push(payload); 
        addAct(`Thêm mới thiết bị máy: ${payload.name}`); 
      }
      closeMachineDialog(); render();
      await Promise.all([syncNode("machines", machines), syncNode("maintenanceJobs", maintenanceJobs), syncNode("activities", activities)]);
    }

    async function deleteMachine(id) {
      if(!confirm("Cảnh báo: Hành động xóa máy này sẽ đồng thời xóa vĩnh viễn tất cả các lịch bảo trì (Job) liên quan của máy đó. Bạn vẫn muốn tiếp tục?")) return;
      const mName = machines.find(x => x.id === id)?.name || "thiết bị";
      machines = machines.filter(x => x.id !== id);
      maintenanceJobs = maintenanceJobs.filter(j => j.machineId !== id);
      expandedMaintenanceMachineIds.delete(id);
      addAct(`Xóa hồ sơ máy: ${mName}`); render();
      await Promise.all([fbFetch(`machines/${id}`, "DELETE"), syncNode("maintenanceJobs", maintenanceJobs), syncNode("activities", activities)]);
    }

    // JOB BẢO TRÌ
    function openJobDialog(id = "", selectedMachineId = "") {
      if (machines.length === 0) {
        alert("Lỗi: Bạn cần tạo dữ liệu thông tin Máy móc nhà xưởng trước khi lập kế hoạch Job bảo trì!");
        return;
      }
      updateMachineSelectOptions();
      const j = maintenanceJobs.find(x => x.id === id);
      els.jobTitle.textContent = j ? "Sửa đổi thông tin Job" : "Thiết lập Job Bảo trì mới";
      els.jId.value = j?.id || "";
      els.jMachineSelect.value = j?.machineId || selectedMachineId || "";
      els.jName.value = j?.jobName || "";
      els.jFrequency.value = recurrenceForJob(j || { recurrence: "monthly" });
      els.jNextDate.value = j?.nextDate || new Date().toISOString().slice(0,10);
      els.jOwner.value = j?.owner || "";
      els.jEstimatedTime.value = j?.estimatedTime || "";
      els.jDesc.value = j?.desc || "";
      els.jobDialog.showModal();
    }
    function closeJobDialog() { els.jobDialog.close(); els.jobForm.reset(); }

    async function saveJob(e) {
      e.preventDefault();
      const mId = els.jMachineSelect.value;
      const targetMachine = machines.find(x => x.id === mId);
      if(!targetMachine) return;

      const id = els.jId.value || crypto.randomUUID();
      const recurrence = els.jFrequency.value;
      const payload = {
        id,
        machineId: mId,
        machineName: targetMachine.name,
        jobName: els.jName.value.trim(),
        recurrence,
        period: frequencyDetails[recurrence].months || 0,
        nextDate: els.jNextDate.value,
        owner: els.jOwner.value.trim(),
        estimatedTime: els.jEstimatedTime.value.trim(),
        createdBy: maintenanceJobs.find(x => x.id === id)?.createdBy || displayName(),
        desc: els.jDesc.value.trim()
      };

      const idx = maintenanceJobs.findIndex(x => x.id === id);
      if (idx >= 0) {
        maintenanceJobs[idx] = payload;
        addAct(`Cập nhật Job [${payload.jobName}] - Máy ${payload.machineName}`);
      } else {
        maintenanceJobs.push(payload);
        addAct(`Lập lịch Job mới [${payload.jobName}] cho Máy ${payload.machineName}`);
      }
      closeJobDialog(); render();
      await Promise.all([syncNode("maintenanceJobs", maintenanceJobs), syncNode("activities", activities)]);
    }

    async function deleteJob(id) {
      if(!confirm("Bạn thực sự muốn xóa bỏ kế hoạch bảo trì này?")) return;
      const jName = maintenanceJobs.find(x => x.id === id)?.jobName || "Job";
      maintenanceJobs = maintenanceJobs.filter(x => x.id !== id);
      addAct(`Hủy lịch bảo dưỡng: ${jName}`); render();
      await Promise.all([syncNode("maintenanceJobs", maintenanceJobs), syncNode("activities", activities)]);
    }

    // Hoàn thành Job bảo trì định kỳ -> Chuyển chu kỳ tiếp theo
    async function completeAndRenewJob(id) {
      const j = maintenanceJobs.find(x => x.id === id);
      if(!j) return;
      
      const currentNextDate = new Date(j.nextDate);
      if(isNaN(currentNextDate.getTime())) return;

      // Lưu lại thông tin hoàn tất lịch sử bảo dưỡng
      const histPayload = {
        id: crypto.randomUUID(),
        machine: j.machineName,
        faultTime: new Date().toISOString().slice(0,10),
        staff: "Bảo Trì Định Kỳ",
        fault: `Đến kỳ hạn bảo trì hạng mục: [${j.jobName}]`,
        fix: `Đã hoàn thành kiểm tra và xử lý kỹ thuật định kỳ thành công theo đúng quy trình: \n${j.desc || 'Đạt yêu cầu tiêu chuẩn kỹ thuật'}`
      };
      repairHistory.push(histPayload);

      const schedule = frequencyDetails[recurrenceForJob(j)];
      if (schedule.days) currentNextDate.setDate(currentNextDate.getDate() + schedule.days);
      else currentNextDate.setMonth(currentNextDate.getMonth() + schedule.months);
      j.nextDate = currentNextDate.toISOString().slice(0, 10);

      addAct(`Đã hoàn tất bảo trì & Đổi lịch kế tiếp Job: ${j.jobName}`);
      render();
      showToast("Xác nhận hoàn tất! Hệ thống đã đẩy lịch sang chu kỳ tiếp theo.");
      await Promise.all([syncNode("maintenanceJobs", maintenanceJobs), fbFetch(`repairHistory/${histPayload.id}`, "PUT", histPayload), syncNode("activities", activities)]);
    }

    // NHẬT KÝ SỰ CỐ ĐỘT XUẤT
    function openHistoryDialog(id = "") {
      if (role() !== "admin") { showToast("Chỉ Quản trị viên được chỉnh sửa nhật ký sự cố."); return; }
      const h = repairHistory.find(x => x.id === id);
      els.historyTitle.textContent = h ? "Sửa nhật ký sửa chữa" : "Ghi nhận sự cố mới";
      els.historyId.value = h?.id || "";
      els.machineInput.value = h?.machine || "";
      els.faultTimeInput.value = h?.faultTime || new Date().toISOString().slice(0,10);
      els.staffInput.value = h?.staff || "";
      els.faultInput.value = h?.fault || "";
      els.fixInput.value = h?.fix || "";
      els.historyImageInput.value = "";
      if (h && h.image) {
        els.historyImageDataHidden.value = h.image;
        els.historyImagePreview.src = h.image;
        els.historyImagePreviewWrap.style.display = "block";
      } else {
        els.historyImageDataHidden.value = "";
        els.historyImagePreview.src = "";
        els.historyImagePreviewWrap.style.display = "none";
      }
      els.historyDialog.showModal();
    }
    
    function closeHistoryDialog() { els.historyDialog.close(); els.historyForm.reset(); }
    
    async function saveRepairHistory(e) {
      e.preventDefault();
      if (role() !== "admin") { closeHistoryDialog(); showToast("Chỉ Quản trị viên được chỉnh sửa nhật ký sự cố."); return; }
      const id = els.historyId.value;
      const idx = repairHistory.findIndex(x => x.id === id);
      if (idx < 0) { closeHistoryDialog(); showToast("Chỉ có thể chỉnh sửa nhật ký sự cố đã tồn tại."); return; }
      const payload = {
        id, machine: els.machineInput.value.trim(), faultTime: els.faultTimeInput.value,
        staff: els.staffInput.value.trim(), fault: els.faultInput.value.trim(), fix: els.fixInput.value.trim(),
        image: els.historyImageDataHidden.value || ""
      };
      repairHistory[idx] = payload;
      addAct(`Quản trị viên sửa lịch sử sự cố máy: ${payload.machine}`);
      closeHistoryDialog(); render();
      await Promise.all([fbFetch(`repairHistory/${id}`, "PUT", payload), syncNode("activities", activities)]);
    }

    async function deleteHistory(id) {
      if (role() !== "admin") { showToast("Chỉ Quản trị viên được xóa nhật ký sự cố."); return; }
      if (!confirm("Quản trị viên xác nhận xóa nhật ký sự cố này?")) return;
      const hName = repairHistory.find(x => x.id === id)?.machine || "máy";
      repairHistory = repairHistory.filter(x => x.id !== id);
      addAct(`Quản trị viên xóa lịch sử sự cố: ${hName}`);
      render();
      await Promise.all([fbFetch(`repairHistory/${id}`, "DELETE"), syncNode("activities", activities)]);
    }

    function addAct(text) {
      activities.unshift({ at: new Date().toISOString(), text });
      // Nhật ký thao tác độc lập với bảng hoạt động nhanh trên dashboard.
      void writeDeviceHistory("CMMS", text);
    }
    
    function showToast(msg) { 
      els.toast.textContent = msg; 
      els.toast.classList.add("show"); 
      setTimeout(() => els.toast.classList.remove("show"), 3500); 
    }
    
    function formatDateDisplay(val) {
      if(!val) return "-";
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    }
    
    function escapeHtml(v) {
      return String(v??'').replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
    }

    //ẨN/HIỆN PASSWORD
    const togglePasswordBtn = document.querySelector("#togglePasswordBtn");
    togglePasswordBtn.addEventListener("click", () => {
      const type = els.passwordInput.getAttribute("type") === "password" ? "text" : "password";
      els.passwordInput.setAttribute("type", type);
      togglePasswordBtn.textContent = type === "password" ? "HIỆN" : "ẨN";
    });

    // SỰ KIỆN KHỞI CHẠY (EVENT LISTENERS)
    els.addBtn.addEventListener("click", () => openItemDialog());
    els.addMachineMainBtn.addEventListener("click", () => openMachineDialog());
    els.addCncMainBtn.addEventListener("click", () => openCncDialog()); // Sự kiện thêm máy CNC bên Header
    els.addJobMainBtn.addEventListener("click", () => openJobDialog());
    document.querySelector("#addMachineBtn").addEventListener("click", () => openMachineDialog());
    els.addMaintenanceMachineBtn.addEventListener("click", () => openMachineDialog());
    document.querySelector("#addCncBtn").addEventListener("click", () => openCncDialog()); // Sự kiện thêm máy CNC nút trong tab
    document.querySelector("#addJobBtn").addEventListener("click", () => openJobDialog());
    els.toggleAdminAuditBtn.addEventListener("click", toggleAdminAudit);
    els.adminAuditEntry.querySelector(":scope > .section-head").addEventListener("click", event => {
      if (!event.target.closest("button")) toggleAdminAudit();
    });
    
    document.querySelector("#closeDialog").addEventListener("click", closeItemDialog);
    document.querySelector("#cancelBtn").addEventListener("click", closeItemDialog);
    document.querySelector("#closeCncDialog").addEventListener("click", closeCncDialog); // Close CNC Dialog
    document.querySelector("#cancelCncBtn").addEventListener("click", closeCncDialog);
    document.querySelector("#closeCncAlarmHistoryBtn").addEventListener("click", closeCncAlarmHistoryDialog);
    document.querySelector("#closeCncAlarmHistoryFootBtn").addEventListener("click", closeCncAlarmHistoryDialog);
    els.cncAlarmHistoryDialog.addEventListener("close", () => { cncAlarmHistoryViewId = null; });
    document.querySelector("#closeMoveDialog").addEventListener("click", closeMoveDialog);
    document.querySelector("#cancelMoveBtn").addEventListener("click", closeMoveDialog);
    document.querySelector("#closeHistoryDialog").addEventListener("click", closeHistoryDialog);
    document.querySelector("#cancelHistoryBtn").addEventListener("click", closeHistoryDialog);
    document.querySelector("#closeMachineDialog").addEventListener("click", closeMachineDialog);
    document.querySelector("#cancelMachineBtn").addEventListener("click", closeMachineDialog);
    document.querySelector("#closeJobDialog").addEventListener("click", closeJobDialog);
    document.querySelector("#cancelJobBtn").addEventListener("click", closeJobDialog);
    
    document.querySelector("#logoutBtn").addEventListener("click", logout);
    els.loginForm.addEventListener("submit", function(e) {
      e.preventDefault();
      login(e);
    });

    // Đổi trang mượt mà
    document.querySelectorAll(".nav button").forEach(button => {
      button.addEventListener("click", () => {
        document.querySelectorAll(".nav button").forEach(entry => entry.classList.remove("active"));
        button.classList.add("active");
        switchPage(button.dataset.page);
      });
    });

    // Tìm kiếm & Lọc dữ liệu đầu vào (Input/Select listeners)
    els.searchInput.addEventListener("input", render);
    els.skuSearchInput.addEventListener("input", render);
    els.categoryFilter.addEventListener("change", render);
    els.statusFilter.addEventListener("change", render);
    els.machineSearchInput.addEventListener("input", render);
    els.jobSearchInput.addEventListener("input", render);
    els.historySearchInput.addEventListener("input", render);
    els.historyFromInput.addEventListener("change", render);
    els.historyToInput.addEventListener("change", render);
    els.cncSearchInput.addEventListener("input", renderCncGridOnly); // Lọc tìm kiếm CNC realtime
    
    // Nộp form thông tin
    els.itemForm.addEventListener("submit", saveItem);
    els.cncForm.addEventListener("submit", saveCnc); // Submit Form CNC
    els.moveForm.addEventListener("submit", saveMovement);
    els.historyForm.addEventListener("submit", saveRepairHistory);
    els.machineForm.addEventListener("submit", saveMachine);
    els.jobForm.addEventListener("submit", saveJob);

    // Xử lý nén và đổi hình ảnh thành mã hóa văn bản Base64
    els.itemImageInput.addEventListener("change", function(e) {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = function(evt) {
        els.itemImageDataHidden.value = evt.target.result;
        els.itemImagePreview.src = evt.target.result;
        els.itemImagePreviewWrap.style.display = "block";
      };
      reader.readAsDataURL(file);
    });

    els.historyImageInput.addEventListener("change", function(e) {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = function(evt) {
        els.historyImageDataHidden.value = evt.target.result;
        els.historyImagePreview.src = evt.target.result;
        els.historyImagePreviewWrap.style.display = "block";
      };
      reader.readAsDataURL(file);
    });

    // XUẤT CSV CHUẨN ĐỒNG BỘ EXCEL (TIẾNG VIỆT CÓ DẤU)
    els.exportBtn.addEventListener("click", () => {
      const h = ["Tên linh kiện", "Mã SKU", "Nhóm linh kiện", "Thông số kỹ thuật", "Số lượng thực tế", "Tồn tối thiểu", "Vị trí kệ", "Thiết bị áp dụng", "Giá tham khảo"];
      const r = items.map(i => [i.name, i.sku, i.category, i.specs || '', i.quantity, i.min, i.location, i.supplier, i.price]);
      downloadCsv(h, r, "kho-linh-kien-ltd");
    });
    els.exportMachineBtn.addEventListener("click", () => {
      const h = ["Tên máy", "Model máy", "Số Serial", "Ngày lắp", "Hạn bảo hành", "Nhà cung cấp", "SĐT"];
      const r = machines.map(m => [m.name, m.model || "", m.serial || "", formatDateDisplay(m.setupDate), formatDateDisplay(m.warranty), m.vendor, m.phone]);
      downloadCsv(h, r, "danh-sach-may-ltd");
    });
    els.exportCncBtn.addEventListener("click", () => {
      openCncReports({ getMachines: () => cncs, getToken, databaseUrl: DB_URL });
    });

    function exportCncAlarmExcel() {
      const alarmList = [...cncAlarmHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      const h = ["Thời gian phát hiện", "Tên máy CNC", "Mã Alarm", "Mô tả chi tiết lỗi", "Nhóm linh kiện", "Trạng thái", "Thời gian xử lý", "Linh kiện kho LTD", "Tồn kho LTD"];
      const r = alarmList.map(a => {
        const keyword = getAlarmKeyword(a.alarmCode);
        const matchedPart = items.find(i => i.name.toLowerCase().includes(keyword.toLowerCase()));
        const stockLabel = matchedPart
          ? (matchedPart.quantity > 0 ? `Còn ${matchedPart.quantity} (Kệ ${matchedPart.location || "-"})` : "Hết hàng")
          : "Chưa có trong kho";
        const timeStr = `${formatDateDisplay(a.timestamp)} ${new Date(a.timestamp).toLocaleTimeString("vi-VN")}`;
        const resolvedStr = a.resolvedAt
          ? `${formatDateDisplay(a.resolvedAt)} ${new Date(a.resolvedAt).toLocaleTimeString("vi-VN")}`
          : "";
        return [
          timeStr,
          a.cncName,
          a.alarmCode,
          a.description,
          keyword,
          a.resolvedAt ? "Đã xử lý" : "Đang lỗi",
          resolvedStr,
          matchedPart ? matchedPart.name : "—",
          stockLabel
        ];
      });
      downloadExcel(h, r, "lich-su-alarm-cnc-ltd");
      showToast("Đã xuất file Excel lịch sử Alarm CNC.");
    }

    els.exportCncAlarmBtn.addEventListener("click", exportCncAlarmExcel);
    document.querySelector("#exportCncAlarmSectionBtn").addEventListener("click", exportCncAlarmExcel);
    els.exportJobBtn.addEventListener("click", () => {
      const h = ["Tên máy", "Model máy", "Số Serial", "Hạng mục bảo trì", "Chu kỳ", "Ngày thực hiện kế tiếp", "Người phụ trách", "Thời lượng dự kiến", "Người thiết lập", "Công việc cụ thể / Checklist"];
      const r = maintenanceJobs.map(j => { const machine = machines.find(m => m.id === j.machineId) || {}; return [j.machineName, machine.model || "", machine.serial || "", j.jobName, recurrenceLabel(j), formatDateDisplay(j.nextDate), j.owner || "", j.estimatedTime || "", j.createdBy || "", j.desc]; });
      downloadCsv(h, r, "ke-hoach-job-bao-tri-ltd");
    });
    els.exportHistoryBtn.addEventListener("click", () => {
      const h = ["Ngày sửa sự cố", "Máy bị lỗi", "Người chịu trách nhiệm", "Mô tả lỗi", "Phương án xử lý"];
      const r = repairHistory.map(x => [formatDateDisplay(x.faultTime), x.machine, x.staff, x.fault, x.fix]);
      downloadCsv(h, r, "lich-su-sua-may-ltd");
    });

    function movementVoucherNumber(movement, movements = stockMovements) {
      const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit"
      });
      const dayKey = entry => dateFormatter.format(new Date(entry.at)).replaceAll("-", "");
      const day = dayKey(movement);
      const dailyMovements = movements
        .filter(entry => entry.type === movement.type && dayKey(entry) === day)
        .sort((a, b) => new Date(a.at) - new Date(b.at) || a.id.localeCompare(b.id));
      const sequence = String(dailyMovements.findIndex(entry => entry.id === movement.id) + 1).padStart(3, "0");
      return `LTD-${movement.type === "in" ? "PN" : "PX"}${sequence}-${day}`;
    }

    function exportMovementVoucher(id) {
      const movement = stockMovements.find(entry => entry.id === id);
      if (!movement) { showToast("Không tìm thấy giao dịch để in phiếu."); return; }
      const esc = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const isImport = movement.type === "in";
      const voucherType = isImport ? "PHIẾU NHẬP KHO" : "PHIẾU XUẤT KHO";
      const documentNo = movementVoucherNumber(movement);
      const html = `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;color:#111;font-size:12pt}table{border-collapse:collapse;width:100%;margin-top:14px}td,th{border:1px solid #111;padding:8px;vertical-align:top}.no-border td{border:0;padding:2px}.center{text-align:center}.right{text-align:right}.title{font-size:18pt;font-weight:bold}.signature td{height:95px;text-align:center;vertical-align:top;padding-top:10px}</style></head><body><table class="no-border"><tr><td><strong>CÔNG TY LTD VIET NAM</strong><br>HỆ THỐNG QUẢN LÝ KHO & BẢO TRÌ</td><td class="right"><strong>Mã phiếu: ${esc(documentNo)}</strong><br>Ngày lập: ${esc(formatDateDisplay(movement.at))}</td></tr></table><div class="center" style="margin-top:20px"><div class="title">${voucherType}</div><div>Ngày ${esc(formatDateDisplay(movement.at))}</div></div><table><thead><tr><th>STT</th><th>Mã linh kiện</th><th>Tên linh kiện</th><th>Loại giao dịch</th><th>Số lượng</th><th>Tồn trước</th><th>Tồn sau</th></tr></thead><tbody><tr><td class="center">1</td><td>${esc(movement.sku || "-")}</td><td>${esc(movement.itemName)}</td><td>${isImport ? "Nhập kho" : "Xuất kho"}</td><td class="center">${esc(movement.amount)}</td><td class="center">${esc(movement.beforeQuantity)}</td><td class="center">${esc(movement.afterQuantity)}</td></tr></tbody></table><table class="no-border"><tr><td style="width:22%"><strong>Lý do:</strong></td><td>${esc(movement.note || "-")}</td></tr><tr><td><strong>Người thực hiện:</strong></td><td>${esc(movement.actor || "-")}</td></tr><tr><td><strong>Thời gian:</strong></td><td>${esc(new Date(movement.at).toLocaleString("vi-VN"))}</td></tr></table><table class="signature"><tr><td><strong>Người lập phiếu</strong><br><em>(Ký, ghi rõ họ tên)</em></td><td><strong>Thủ kho</strong><br><em>(Ký, ghi rõ họ tên)</em></td><td><strong>Người giao / nhận</strong><br><em>(Ký, ghi rõ họ tên)</em></td><td><strong>Quản lý phê duyệt</strong><br><em>(Ký, ghi rõ họ tên)</em></td></tr></table></body></html>`;
      const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${documentNo}.xls`;
      link.click();
      URL.revokeObjectURL(url);
    }

    function downloadCsv(headers, rows, filename) {
      const csv = [headers, ...rows].map(row => row.map(c => `"${String(c??'').replaceAll('"','""')}"`).join(",")).join("\n");
      const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${filename}-${new Date().toISOString().slice(0,10)}.csv`;
      link.click(); URL.revokeObjectURL(url);
    }

    function downloadExcel(headers, rows, filename) {
      const esc = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      let html = "<html><head><meta charset=\"UTF-8\"></head><body><table border=\"1\"><thead><tr>";
      html += headers.map(h => `<th>${esc(h)}</th>`).join("");
      html += "</tr></thead><tbody>";
      rows.forEach(row => {
        html += "<tr>" + row.map(c => `<td>${esc(c)}</td>`).join("") + "</tr>";
      });
      html += "</tbody></table></body></html>";
      const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.xls`;
      link.click();
      URL.revokeObjectURL(url);
    }

    // Giải phóng kết nối online khi đóng/chuyển trang
    window.addEventListener("beforeunload", () => {
      try { if (typeof mySessionId !== "undefined") navigator.sendBeacon(`${DB_URL}/online_users/${mySessionId}.json?x-http-method-override=DELETE`); } catch(e){}
    });

    // Các hàng được vẽ động vẫn dùng thuộc tính onclick; module ES không tự đưa hàm ra window.
    Object.assign(window, {
      openItemDialog,
      deleteItem,
      openMoveDialog,
      exportMovementVoucher,
      openMachineDialog,
      deleteMachine,
      toggleMaintenanceMachine,
      openJobDialog,
      deleteJob,
      completeAndRenewJob,
      openHistoryDialog,
      deleteHistory,
      openCncDialog,
      deleteCnc,
      resolveCncAlarm,
      openCncMachineAlarmHistory,
      autoCreateRepairHistoryFromCncAlarm
    });

    // Chỉ khôi phục phiên sau một lần đăng nhập chủ động trong tab hiện tại.
    const initialSessionReady = initializeSession();
    initialSessionReady.catch(() => {}); // Login reports initialization errors.
    onSessionChanged(user => {
      if (manualLoginInProgress) return;
      const hasExplicitLogin = sessionStorage.getItem("ltd_explicit_cmms_login") === "1";
      if (user?.emailVerified && hasExplicitLogin) {
        unlockApp();
        return;
      }
      document.body.classList.add("locked");
    });
    els.toggleRegistrationBtn.addEventListener("click", () => setRegistrationMode(!registrationMode));
  
