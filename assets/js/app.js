
    import { onSessionChanged, signIn, signOutUser, sendVerification, registerAccount, getToken, getUser, loadProfile, role, canEdit, displayName } from "./auth.js";
    import { firebaseConfig } from "./firebase-config.js";

    const DB_URL = firebaseConfig.databaseURL;

    if (!sessionStorage.getItem("ltd_user_session_id")) {
      sessionStorage.setItem("ltd_user_session_id", crypto.randomUUID());
    }
    const mySessionId = sessionStorage.getItem("ltd_user_session_id");

    let items = [];
    let activities = [];
    let repairHistory = [];
    let machines = [];
    let maintenanceJobs = []; 
    let cncs = []; // Mảng quản lý máy CNC mới
    let cncAlarmHistory = []; // Mảng lưu lịch sử Alarm CNC
    let cncAlarmHistoryViewId = null;
    let cncRealtimeSyncStarted = false;

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
      resultCount: document.querySelector("#resultCount"),
      inventoryBody: document.querySelector("#inventoryBody"),
      machineListBody: document.querySelector("#machineListBody"),
      jobListBody: document.querySelector("#jobListBody"),
      historyList: document.querySelector("#historyList"),
      searchInput: document.querySelector("#searchInput"),
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
      cncLocationInput: document.querySelector("#cncLocationInput"),

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
      jPeriod: document.querySelector("#jPeriodInput"),
      jNextDate: document.querySelector("#jNextDateInput"),
      jDesc: document.querySelector("#jDescInput"),

      loginForm: document.querySelector("#loginForm"),
      emailInput: document.querySelector("#emailInput"),
      passwordInput: document.querySelector("#passwordInput"),
      fullNameInput: document.querySelector("#fullNameInput"),
      confirmPasswordInput: document.querySelector("#confirmPasswordInput"),
      registrationFields: document.querySelector("#registrationFields"),
      toggleRegistrationBtn: document.querySelector("#toggleRegistrationBtn"),
      submitLoginBtn: document.querySelector("#submitLoginBtn"),
      loginError: document.querySelector("#loginError"),
      toast: document.querySelector("#toast")
    };

    // Thiết lập ngày tháng năm hiện tại
    els.todayLabel.textContent = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long", day: "2-digit", month: "2-digit", year: "numeric"
    }).format(new Date());

    async function fbFetch(path, method = "GET", body = null) {
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
        return null;
      }
    }

    async function loadCloudData() {
      if(els.resultCount) els.resultCount.textContent = "Đang đồng bộ dữ liệu đám mây...";
      try {
        const [cloudItems, cloudActivities, cloudHistory, cloudMachines, cloudJobs, cloudCncs, cloudCncAlarms] = await Promise.all([
          fbFetch("items"),
          fbFetch("activities"),
          fbFetch("repairHistory"),
          fbFetch("machines"),
          fbFetch("maintenanceJobs"),
          fbFetch("cncs"), // Tải dữ liệu CNC
          fbFetch("cncAlarms") // Tải dữ liệu lịch sử Alarm CNC
        ]);

        items = cloudItems ? Object.values(cloudItems) : [];
        activities = cloudActivities ? Object.values(cloudActivities) : [{ at: new Date().toISOString(), text: "Hệ thống mây đã sẵn sàng." }];
        repairHistory = cloudHistory ? Object.values(cloudHistory) : [];
        machines = cloudMachines ? Object.values(cloudMachines) : [];
        maintenanceJobs = cloudJobs ? Object.values(cloudJobs) : [];
        cncs = cloudCncs ? Object.values(cloudCncs) : [];
        cncAlarmHistory = cloudCncAlarms ? Object.values(cloudCncAlarms) : [];

        // Nếu lần đầu chưa có máy CNC, tự động tạo máy CNC demo
        if (cncs.length === 0) {
          cncs = [
            { id: "cnc-1", name: "Máy Tiện CNC Fanuc 01 (0i-F)", ip: "192.168.1.101", port: 8193, model: "Fanuc 0i-F", location: "Khu vực CNC - Lô A1", status: "running", activeProgram: "O1024 (LTD_SHAFT_CUT)", currentBlock: "N140 G01 X45.2 Z-20.5 F0.18", spindleSpeed: 1800, targetSpindleSpeed: 1800, feedrate: 150, targetFeedrate: 150, override: 100, alarm: "" },
            { id: "cnc-2", name: "Máy Phay CNC Fanuc 02 (0i-F)", ip: "192.168.1.102", port: 8193, model: "Fanuc 0i-F", location: "Khu vực CNC - Lô A2", status: "hold", activeProgram: "O3005 (LTD_MOLD_BASE)", currentBlock: "N80 M01 (PAUSE CHECK)", spindleSpeed: 0, targetSpindleSpeed: 3200, feedrate: 0, targetFeedrate: 450, override: 0, alarm: "" },
            { id: "cnc-3", name: "Trung Tâm Gia Công 03 (31i-B)", ip: "192.168.1.103", port: 8193, model: "Fanuc 31i-B", location: "Khu vực CNC - Lô B1", status: "alarm", activeProgram: "O8890 (LTD_IMPELLER_5AX)", currentBlock: "N420 G43 H02 Z10.0", spindleSpeed: 0, targetSpindleSpeed: 8000, feedrate: 0, targetFeedrate: 1200, override: 100, alarm: "ALARM SV0311 - LỖI QUÁ DÒNG SERVO MOTOR TRỤC X" }
          ];
          await syncNode("cncs", cncs);
        }

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

        // Bắt đầu vòng lặp cập nhật IoT máy CNC (để tạo cảm giác thời gian thực)
        startCncSimulationLoop();
        startCncRealtimeSync();
      } catch (e) {
        console.error("Lỗi kết nối máy chủ:", e);
      }
    }

    function startCncRealtimeSync() {
      if (cncRealtimeSyncStarted) return;
      cncRealtimeSyncStarted = true;
      setInterval(async () => {
        try {
          const [cloudCncs, cloudCncAlarms] = await Promise.all([fbFetch("cncs"), fbFetch("cncAlarms")]);
          if (cloudCncs) cncs = Object.values(cloudCncs);
          if (cloudCncAlarms) cncAlarmHistory = Object.values(cloudCncAlarms);

          let hasNewAlarm = false;
          cncs.forEach(c => { if (ensureAlarmRecorded(c)) hasNewAlarm = true; });
          if (hasNewAlarm) await syncNode("cncAlarms", cncAlarmHistory);

          if (!els.cncMonitoringPage.hidden) {
            els.statCncTotal.textContent = number.format(cncs.length);
            els.statCncRunning.textContent = number.format(cncs.filter(c => c.status === "running").length);
            els.statCncHold.textContent = number.format(cncs.filter(c => c.status === "hold").length);
            els.statCncAlarm.textContent = number.format(cncs.filter(c => c.status === "alarm").length);
            renderCncTable();
          }

          if (!els.overviewPage.hidden) {
            updateOverviewQuickStats();
          }

          if (cncAlarmHistoryViewId && els.cncAlarmHistoryDialog.open) {
            renderCncMachineAlarmHistory(cncAlarmHistoryViewId);
          }
        } catch (e) {}
      }, 5000);
    }

    function extractAlarmCode(alarmText) {
      const match = String(alarmText || "").match(/\b(SV|SP|OT|AL)\d{3,4}\b/i);
      return match ? match[0].toUpperCase() : "UNKNOWN";
    }

    function ensureAlarmRecorded(c) {
      if (c.status !== "alarm" || !c.alarm) return false;
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

    // Giả lập cập nhật các giá trị của CNC theo thời gian thực (giống FOCAS thật)
    function startCncSimulationLoop() {
      setInterval(async () => {
        let hasChanges = false;
        cncs.forEach(c => {
          if (c.status === "running") {
            // Dao động tốc độ trục chính và feedrate thực tế quanh mức target
            const deltaSpindle = Math.floor((Math.random() - 0.5) * 10);
            c.spindleSpeed = Math.max(0, c.targetSpindleSpeed + deltaSpindle);
            
            const deltaFeed = Math.floor((Math.random() - 0.5) * 4);
            c.feedrate = Math.max(0, c.targetFeedrate + deltaFeed);
            
            // Thay đổi block N-code ngẫu nhiên
            if (Math.random() > 0.7) {
              const blocks = ["G01", "G02", "G03", "G00"];
              c.currentBlock = `N${Math.floor(Math.random() * 500)} ${blocks[Math.floor(Math.random() * 4)]} X${(Math.random()*100).toFixed(1)} Z${(Math.random()*-50).toFixed(1)}`;
            }
            hasChanges = true;
          }
        });
        if (hasChanges && document.getElementById("cncMonitoringPage").hidden === false) {
          renderCncGridOnly();
        }
      }, 3000);
    }

    async function checkOnlineUsers() {
      try {
        const allSessions = await fbFetch("online_users");
        if (allSessions) {
          const now = Date.now();
          let activeCount = 0;
          for (const id in allSessions) {
            if (now - allSessions[id].timestamp < 45000) { activeCount++; } 
            else { fbFetch(`online_users/${id}`, "DELETE"); }
          }
          const label = document.querySelector("#onlineCountLabel");
          if (label) {
            label.innerHTML = `<span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; animation: rise 1.5s infinite alternate;"></span> Đang truy cập: <span style="font-size:14px; background:#fff; color:#0f241d; padding:2px 8px; border-radius:99px; font-weight: 800; margin:0 4px;">${activeCount}</span> người`;
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
      const userVal = els.emailInput.value.trim();
      const passVal = els.passwordInput.value;
      els.loginError.textContent = "";
      try {
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
      } catch (error) {
        const messages = {
          "auth/email-already-in-use": "Email này đã được đăng ký.",
          "auth/weak-password": "Mật khẩu cần có ít nhất 6 ký tự.",
          "password-mismatch": "Mật khẩu xác nhận không khớp."
        };
        els.loginError.textContent = messages[error.code || error.message] || "Email hoặc mật khẩu không hợp lệ.";
        return false;
      }
      return false;
    }

    async function unlockApp() {
      try {
        await loadProfile();
      } catch (error) {
        await signOutUser();
        els.loginError.textContent = "Tài khoản chưa được cấp quyền CMMS. Vui lòng liên hệ quản trị viên.";
        return;
      }
      document.body.classList.remove("locked"); 
      document.body.dataset.role = role();
      applyAuthorization();
      render();
      loadCloudData();
      showToast(`Chào mừng, ${displayName()}. Vai trò: ${role()}.`);
    }
    
    async function logout() {
      try { if (typeof mySessionId !== "undefined") fbFetch(`online_users/${mySessionId}`, "DELETE"); } catch(e){}
      await signOutUser();
      document.body.classList.add("locked"); 
    }

    function applyAuthorization() {
      const allowedToEdit = canEdit();
      document.querySelectorAll("button.primary, button.danger, #addMachineBtn, #addCncBtn, #addJobBtn, #addHistoryBtn").forEach(button => {
        if (button.closest(".login-screen")) return;
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
        els.pageHeading.textContent = "LỊCH TRÌNH BẢO TRÌ";
        els.pageSubtitle.textContent = "Thiết lập nhiều đầu mục công việc kiểm tra cơ điện định kỳ cho từng dòng máy riêng biệt.";
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
      els.statCncRunning.textContent = number.format(cncs.filter(c => c.status === "running").length);
      els.statCncHold.textContent = number.format(cncs.filter(c => c.status === "hold").length);
      els.statCncAlarm.textContent = number.format(cncs.filter(c => c.status === "alarm").length);

      updateOverviewQuickStats();
      renderInventoryTable();
      renderMachineTable();
      renderCncTable();
      renderMaintenanceJobsTable();
      renderHistoryTable();
      renderAlertsAndActivities();
      updateMachineSelectOptions();
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
      if (overviewCncRun) overviewCncRun.textContent = number.format(cncs.filter(c => c.status === "running").length);
      if (overviewCncHold) overviewCncHold.textContent = number.format(cncs.filter(c => c.status === "hold").length);
      if (overviewCncAlarm) overviewCncAlarm.textContent = number.format(cncs.filter(c => c.status === "alarm").length);
      if (overviewMachineTotal) overviewMachineTotal.textContent = number.format(machines.length);
      if (overviewJobOverdue) overviewJobOverdue.textContent = number.format(maintenanceJobs.filter(j => j.nextDate && j.nextDate <= todayStr).length);
    }

    function renderInventoryTable() {
      const term = els.searchInput.value.trim().toLowerCase();
      const cat = els.categoryFilter.value;
      const stat = els.statusFilter.value;

      const rows = items.filter(i => {
        const h = [i.name, i.sku, i.supplier, i.location, i.specs || '', i.note || ''].join(" ").toLowerCase();
        return (!term || h.includes(term)) && (cat === "all" || i.category === cat) && (stat === "all" || itemStatus(i) === stat);
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

    function renderMachineTable() {
      const term = els.machineSearchInput.value.trim().toLowerCase();
      const rows = machines.filter(m => {
        return !term || [m.name, m.vendor].join(" ").toLowerCase().includes(term);
      }).sort((a,b) => a.name.localeCompare(b.name, "vi"));

      if(!rows.length) {
        els.machineListBody.innerHTML = `<tr><td colspan="6" class="empty">Không tìm thấy máy thiết bị cơ điện nào trong cơ sở dữ liệu.</td></tr>`;
        return;
      }

      els.machineListBody.innerHTML = rows.map(m => `<tr>
        <td class="machine-text-cell">${textEllipsisCell(`⚙️ ${m.name}`, "Tên máy thiết bị", "brand-text-cell")}</td>
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
      renderCncGridOnly();
      renderCncAlarmsOnly();
    }

    function renderCncGridOnly() {
      const term = els.cncSearchInput.value.trim().toLowerCase();
      const filteredCncs = cncs.filter(c => {
        return !term || [c.name, c.ip, c.model, c.location].join(" ").toLowerCase().includes(term);
      });

      if (filteredCncs.length === 0) {
        document.querySelector("#cncListGrid").innerHTML = `<div class="empty" style="grid-column: 1/-1;">Không tìm thấy máy CNC kết nối FOCAS nào phù hợp.</div>`;
        return;
      }

      document.querySelector("#cncListGrid").innerHTML = filteredCncs.map(c => {
        let statusText = "MẤT KẾT NỐI";
        let statusClass = "offline";
        if (c.status === "running") { statusText = "ĐANG CHẠY (RUN)"; statusClass = "running"; }
        else if (c.status === "hold") { statusText = "TẠM DỪNG (HOLD)"; statusClass = "hold"; }
        else if (c.status === "alarm") { statusText = "🚨 CẢNH BÁO LỖI (ALARM)"; statusClass = "alarm"; }

        // Tìm kiếm tự động linh kiện khắc phục lỗi trong kho LTD tương ứng với loại alarm
        let matchedPartInfo = "";
        if (c.status === "alarm" && c.alarm) {
          matchedPartInfo = checkAvailablePartsInInventory(c.alarm);
        }

        return `
          <div class="cnc-card" id="card-${c.id}">
            <div class="cnc-header">
              <span class="cnc-title">💻 ${escapeHtml(c.name)}</span>
              <span class="cnc-status ${statusClass}">${statusText}</span>
            </div>
            
            <div class="cnc-details">
              <span class="cnc-label">Địa chỉ IP FOCAS:</span>
              <span class="cnc-value" style="color: var(--brand)">${escapeHtml(c.ip)}:${c.port}</span>
              
              <span class="cnc-label">Model CNC:</span>
              <span class="cnc-value">${escapeHtml(c.model)}</span>
              
              <span class="cnc-label">Chương trình chạy:</span>
              <span class="cnc-value" style="color: var(--accent); font-weight:800;">${escapeHtml(c.activeProgram || "None")}</span>
              
              <span class="cnc-label">Dòng lệnh hiện tại:</span>
              <span class="cnc-value" style="font-size:12px; font-weight: 500">${escapeHtml(c.currentBlock || "None")}</span>
              
              <span class="cnc-label">Vòng quay trục chính:</span>
              <span class="cnc-value" style="color: var(--ok)">${c.spindleSpeed} / ${c.targetSpindleSpeed} RPM</span>
              
              <span class="cnc-label">Tốc độ ăn dao (Feedrate):</span>
              <span class="cnc-value">${c.feedrate} mm/min (Ovr: ${c.override}%)</span>
              
              <span class="cnc-label">Vị trí nhà xưởng:</span>
              <span class="cnc-value">${escapeHtml(c.location)}</span>
            </div>

            ${c.status === "alarm" ? `
              <div class="cnc-alarm-banner">
                <strong style="color: var(--danger); font-size:13px;">⚠️ PHÁT HIỆN LỖI CNC:</strong>
                <span class="cnc-value" style="color: var(--danger); font-size:12px; font-weight:bold;">${escapeHtml(c.alarm)}</span>
              </div>
              ${matchedPartInfo}
            ` : ''}

            <div class="row-actions" style="margin-top:auto; border-top:1px solid var(--line); padding-top:10px;">
              <button class="btn" style="min-height:30px; font-size:12px;" onclick="openCncMachineAlarmHistory('${c.id}')">Lịch sử lỗi</button>
              <button class="btn" style="min-height:30px; font-size:12px;" onclick="openCncDialog('${c.id}')">Sửa IP</button>
              ${c.status === "alarm" ? `
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
      els.cncAlarmHistoryMeta.textContent = `IP FOCAS: ${c.ip}:${c.port} · Vị trí: ${c.location || "—"} · Tổng sự cố: ${cncAlarmHistory.filter(a => a.cncId === cncId).length}`;
      renderCncMachineAlarmHistory(cncId);
      els.cncAlarmHistoryDialog.showModal();
    }

    function renderCncMachineAlarmHistory(cncId) {
      const c = cncs.find(x => x.id === cncId);
      if (c && els.cncAlarmHistoryMeta) {
        els.cncAlarmHistoryMeta.textContent = `IP FOCAS: ${c.ip}:${c.port} · Vị trí: ${c.location || "—"} · Tổng sự cố: ${cncAlarmHistory.filter(a => a.cncId === cncId).length}`;
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
      const a = cncAlarmHistory.find(x => x.id === alarmId);
      if(!a) return;

      switchPage("historyPage");
      document.querySelectorAll(".nav button").forEach(entry => entry.classList.remove("active"));
      document.querySelector('[data-page="historyPage"]').classList.add("active");

      // Mở dialog sửa chữa, điền sẵn thông tin sự cố kết nối
      openHistoryDialog();
      els.machineInput.value = a.cncName;
      els.faultTimeInput.value = new Date(a.timestamp).toISOString().slice(0, 10);
      els.faultInput.value = `Ghi nhận lỗi IoT qua Ethernet Fanuc FOCAS API: \nMã lỗi: [${a.alarmCode}] - ${a.description}`;
      els.fixInput.value = `Tiến hành kiểm tra tủ điều khiển điện máy CNC. Sửa chữa lỗi bằng cách thay thế linh kiện...`;
    }

    // Xóa máy CNC
    async function deleteCnc(id) {
      if (!confirm("Bạn chắc chắn muốn ngắt kết nối và xóa máy CNC này?")) return;
      cncs = cncs.filter(c => c.id !== id);
      addAct("Xóa máy CNC khỏi hệ thống giám sát.");
      render();
      await Promise.all([syncNode("cncs", cncs), syncNode("activities", activities)]);
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
        location: els.cncLocationInput.value.trim(),
        status: "running", // Mặc định máy mới kết nối trạng thái RUNNING
        activeProgram: "O1000 (DEMO_PROGRAM)",
        currentBlock: "N10 G00 G90 G21",
        spindleSpeed: 1200,
        targetSpindleSpeed: 1200,
        feedrate: 100,
        targetFeedrate: 100,
        override: 100,
        alarm: ""
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
      await Promise.all([syncNode("cncs", cncs), syncNode("activities", activities)]);
    }

    function openCncDialog(id = "") {
      const c = cncs.find(x => x.id === id);
      els.cncTitle.textContent = c ? "Chỉnh sửa kết nối máy CNC" : "Thêm máy CNC mới";
      els.cncId.value = c?.id || "";
      els.cncNameInput.value = c?.name || "";
      els.cncIpInput.value = c?.ip || "";
      els.cncPortInput.value = c?.port || 8193;
      els.cncModelInput.value = c?.model || "Fanuc 0i-F";
      els.cncLocationInput.value = c?.location || "";
      els.cncDialog.showModal();
    }
    function closeCncDialog() { els.cncDialog.close(); els.cncForm.reset(); }

    // XỬ LÝ SỬA XONG ALARM (XÓA LỖI MÁY CNC)
    async function resolveCncAlarm(id) {
      const c = cncs.find(x => x.id === id);
      if (!c) return;

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
      await Promise.all([syncNode("cncs", cncs), syncNode("cncAlarms", cncAlarmHistory), syncNode("activities", activities)]);

      if (cncAlarmHistoryViewId === id && els.cncAlarmHistoryDialog.open) {
        renderCncMachineAlarmHistory(id);
      }
    }

    function renderMaintenanceJobsTable() {
      const term = els.jobSearchInput.value.trim().toLowerCase();
      const rows = maintenanceJobs.filter(j => {
        return !term || [j.machineName, j.jobName, j.desc].join(" ").toLowerCase().includes(term);
      }).sort((a,b) => a.nextDate.localeCompare(b.nextDate));

      if(!rows.length) {
        els.jobListBody.innerHTML = `<tr><td colspan="7" class="empty">Không tìm thấy công việc (job) bảo trì nào được lên kế hoạch.</td></tr>`;
        return;
      }

      const todayStr = new Date().toISOString().slice(0, 10);

      els.jobListBody.innerHTML = rows.map(j => {
        const isOverdue = j.nextDate <= todayStr;
        const statusPill = isOverdue 
          ? `<span class="pill danger" style="padding: 4px 10px; font-weight:800;">🚨 Đến kỳ hạn</span>`
          : `<span class="pill ok">Đang theo dõi</span>`;

        return `<tr>
          <td class="col-text-wide job-text-cell">${textEllipsisCell(j.machineName, "Tên thiết bị máy", "strong-text")}</td>
          <td class="col-text-wide job-text-cell">${textEllipsisCell(`📌 ${j.jobName}`, "Hạng mục / công việc bảo trì", "brand-text-cell")}</td>
          <td><span class="job-period">${escapeHtml(j.period)} Tháng</span></td>
          <td><span class="job-date" style="color: ${isOverdue ? 'var(--danger)' : 'var(--ok)'};">${formatDateDisplay(j.nextDate)}</span></td>
          <td class="col-text-wide job-text-cell">${textEllipsisCell(j.desc, "Mô tả chi tiết kỹ thuật Job", "muted-text-cell")}</td>
          <td>${statusPill}</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" style="background: #e6f4ea; color: var(--ok); border-color: rgba(21,128,61,0.2)" type="button" title="Hoàn tất bảo trì kỳ này và tự tạo kỳ tới" onclick="completeAndRenewJob('${j.id}')">${checkIcon}</button>
              <button class="icon-btn" type="button" onclick="openJobDialog('${j.id}')" title="Sửa lịch trình">${editIcon}</button>
              <button class="icon-btn danger" type="button" onclick="deleteJob('${j.id}')" title="Hủy bỏ Job này">${deleteIcon}</button>
            </div>
          </td>
        </tr>`;
      }).join("");
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
        els.historyList.innerHTML = `<tr><td colspan="7" class="empty">Không tìm thấy nhật ký sự cố sửa chữa nào phù hợp.</td></tr>`;
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
          <td class="col-img">${imageThumbCell(displayImage, h.id, "history")}</td>
          <td>
            <div class="row-actions">
              <button class="icon-btn" type="button" onclick="openHistoryDialog('${h.id}')" title="Sửa lịch sử">${editIcon}</button>
              <button class="icon-btn danger" type="button" onclick="deleteHistory('${h.id}')" title="Xóa lịch sử sự cố này">${deleteIcon}</button>
            </div>
          </td>
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
              <div class="meta">Hạn dự kiến: ${formatDateDisplay(j.nextDate)}. Chu kỳ: ${j.period} tháng.</div>
            </div>
          `;
        }
      });

      // 2. Quét máy CNC đang trong trạng thái Alarm
      cncs.forEach(c => {
        if (c.status === "alarm") {
          alertHtml += `
            <div class="alert-item" style="border-left: 4px solid var(--danger); background: #fff8f8;">
              <strong style="color: var(--danger)">🚨 CNC ALARM (FANUC IoT)</strong>
              <div style="font-weight:800; margin-top:2px;">${escapeHtml(c.name)}</div>
              <div style="font-size:12px; color: var(--danger); font-family: monospace;">${escapeHtml(c.alarm)}</div>
              <div class="meta">IP: ${escapeHtml(c.ip)}. Hãy kiểm tra linh kiện LTD để sửa đổi khẩn cấp.</div>
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
      item.quantity += (els.moveType.value === "in" ? amt : -amt);
      addAct(`${els.moveType.value === 'in' ? 'Nhập kho thêm' : 'Xuất kho dùng'} ${amt} chiếc ${item.name}`);
      closeMoveDialog(); render();
      await Promise.all([syncNode("items", items), syncNode("activities", activities)]);
    }

    // MÁY MÓC NHÀ XƯỞNG
    function openMachineDialog(id = "") {
      const m = machines.find(x => x.id === id);
      els.machineTitle.textContent = m ? "Sửa thông tin máy móc" : "Thêm máy thiết bị mới";
      els.mId.value = m?.id || "";
      els.mName.value = m?.name || "";
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
        id, name: els.mName.value.trim(), setupDate: els.mSetupDate.value,
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
      addAct(`Xóa hồ sơ máy: ${mName}`); render();
      await Promise.all([fbFetch(`machines/${id}`, "DELETE"), syncNode("maintenanceJobs", maintenanceJobs), syncNode("activities", activities)]);
    }

    // JOB BẢO TRÌ
    function openJobDialog(id = "") {
      if (machines.length === 0) {
        alert("Lỗi: Bạn cần tạo dữ liệu thông tin Máy móc nhà xưởng trước khi lập kế hoạch Job bảo trì!");
        return;
      }
      updateMachineSelectOptions();
      const j = maintenanceJobs.find(x => x.id === id);
      els.jobTitle.textContent = j ? "Sửa đổi thông tin Job" : "Thiết lập Job Bảo trì mới";
      els.jId.value = j?.id || "";
      els.jMachineSelect.value = j?.machineId || "";
      els.jName.value = j?.jobName || "";
      els.jPeriod.value = j?.period || "3";
      els.jNextDate.value = j?.nextDate || new Date().toISOString().slice(0,10);
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
      const payload = {
        id,
        machineId: mId,
        machineName: targetMachine.name,
        jobName: els.jName.value.trim(),
        period: Number(els.jPeriod.value),
        nextDate: els.jNextDate.value,
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

      // Tính ngày tiếp theo của chu kỳ: Ngày cũ + Chu kỳ lặp (Tháng)
      currentNextDate.setMonth(currentNextDate.getMonth() + Number(j.period));
      j.nextDate = currentNextDate.toISOString().slice(0, 10);

      addAct(`Đã hoàn tất bảo trì & Đổi lịch kế tiếp Job: ${j.jobName}`);
      render();
      showToast("Xác nhận hoàn tất! Hệ thống đã đẩy lịch sang chu kỳ tiếp theo.");
      await Promise.all([syncNode("maintenanceJobs", maintenanceJobs), syncNode("repairHistory", repairHistory), syncNode("activities", activities)]);
    }

    // NHẬT KÝ SỰ CỐ ĐỘT XUẤT
    function openHistoryDialog(id = "") {
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
      const id = els.historyId.value || crypto.randomUUID();
      const payload = {
        id, machine: els.machineInput.value.trim(), faultTime: els.faultTimeInput.value,
        staff: els.staffInput.value.trim(), fault: els.faultInput.value.trim(), fix: els.fixInput.value.trim(),
        image: els.historyImageDataHidden.value || ""
      };
      const idx = repairHistory.findIndex(x => x.id === id);
      if(idx >= 0) { repairHistory[idx] = payload; addAct(`Sửa lịch sử sự cố máy: ${payload.machine}`); }
      else { repairHistory.push(payload); addAct(`Ghi sự cố đột xuất máy: ${payload.machine}`); }
      closeHistoryDialog(); render();
      await Promise.all([syncNode("repairHistory", repairHistory), syncNode("activities", activities)]);
    }

    async function deleteHistory(id) {
      if(!confirm("Xác nhận xóa biên bản sửa chữa sự cố này trên đám mây?")) return;
      const hName = repairHistory.find(x => x.id === id)?.machine || "máy";
      repairHistory = repairHistory.filter(x => x.id !== id);
      addAct(`Xóa lịch sử sự cố: ${hName}`); render();
      await Promise.all([fbFetch(`repairHistory/${id}`, "DELETE"), syncNode("activities", activities)]);
    }

    function addAct(text) { activities.unshift({ at: new Date().toISOString(), text }); }
    
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
    document.querySelector("#addCncBtn").addEventListener("click", () => openCncDialog()); // Sự kiện thêm máy CNC nút trong tab
    document.querySelector("#addJobBtn").addEventListener("click", () => openJobDialog());
    document.querySelector("#addHistoryBtn").addEventListener("click", () => openHistoryDialog());
    
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
      const h = ["Tên máy", "Ngày lắp", "Hạn bảo hành", "Nhà cung cấp", "SĐT"];
      const r = machines.map(m => [m.name, formatDateDisplay(m.setupDate), formatDateDisplay(m.warranty), m.vendor, m.phone]);
      downloadCsv(h, r, "danh-sach-may-ltd");
    });
    els.exportCncBtn.addEventListener("click", () => {
      const h = ["Tên máy CNC", "Địa chỉ IP", "Port FOCAS", "Model Bộ điều khiển", "Vị trí lắp đặt", "Trạng thái", "Chương trình hiện tại"];
      const r = cncs.map(c => [c.name, c.ip, c.port, c.model, c.location, c.status, c.activeProgram]);
      downloadCsv(h, r, "danh-sach-may-cnc-ltd");
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
      const h = ["Tên máy xưởng", "Tên Job bảo trì", "Chu kỳ (tháng)", "Ngày đến hạn tiếp theo", "Mô tả chi tiết"];
      const r = maintenanceJobs.map(j => [j.machineName, j.jobName, j.period, formatDateDisplay(j.nextDate), j.desc]);
      downloadCsv(h, r, "ke-hoach-job-bao-tri-ltd");
    });
    els.exportHistoryBtn.addEventListener("click", () => {
      const h = ["Ngày sửa sự cố", "Máy bị lỗi", "Người chịu trách nhiệm", "Mô tả lỗi", "Phương án xử lý"];
      const r = repairHistory.map(x => [formatDateDisplay(x.faultTime), x.machine, x.staff, x.fault, x.fix]);
      downloadCsv(h, r, "lich-su-sua-may-ltd");
    });

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

    onSessionChanged(user => {
      if (user && user.emailVerified) unlockApp();
      else document.body.classList.add("locked");
    });
    els.toggleRegistrationBtn.addEventListener("click", () => setRegistrationMode(!registrationMode));
  
