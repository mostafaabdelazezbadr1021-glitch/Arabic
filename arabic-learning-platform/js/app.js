/**
 * منطق التطبيق الرئيسي والمتحكم العام (App Controller & UI Router)
 * الإصدار الثاني المحسّن: يدير التنقل عبر History API والتوافق مع زر الرجوع بالمتصفح والموبايل،
 * فتح الشروحات والملخصات في شاشات عريضة راقية، وبنك أسئلة تفاعلي بالكامل.
 */

window.App = (function() {
  // حالة التطبيق الراهنة
  let currentView = "home";
  let currentParams = {};
  let activeModal = null; // null | { type: 'grammar', id: stageId }
  let activeLessonId = null;
  let activeQuizState = null;
  let activeExamState = null;
  let examTimerInterval = null;
  let soundEnabled = true;

  // مفتاح حفظ إجابات بنك الأسئلة في الذاكرة المحلية
  const QB_STORAGE_KEY = "arabic_platform_qb_answers_v1";

  // دوال آمنة ومحمية لقراءة وحفظ إجابات بنك الأسئلة
  function getSavedQbAnswers() {
    try {
      const stored = localStorage.getItem(QB_STORAGE_KEY);
      if (!stored) return {};
      const parsed = JSON.parse(stored);
      return (parsed && typeof parsed === "object") ? parsed : {};
    } catch (e) {
      console.warn("تعذر قراءة إجابات بنك الأسئلة من التخزين المحلي:", e);
      return {};
    }
  }

  function saveQbAnswersToStorage(answers) {
    try {
      localStorage.setItem(QB_STORAGE_KEY, JSON.stringify(answers || {}));
    } catch (e) {
      console.warn("تعذر حفظ إجابات بنك الأسئلة في التخزين المحلي:", e);
    }
  }

  function clearQbAnswersFromStorage() {
    try {
      localStorage.removeItem(QB_STORAGE_KEY);
    } catch (e) {
      console.warn("تعذر حذف إجابات بنك الأسئلة من التخزين المحلي:", e);
    }
  }

  // حالة بنك الأسئلة التفاعلي (مسترجعة بأمان من التخزين المحلي)
  let qbState = {
    answers: getSavedQbAnswers(),
    filterLesson: 'all',
    filterType: 'all',
    filterDiff: 'all'
  };

  // إدارة التلميح الإرشادي للموبايل (Onboarding Tooltip)
  let tooltipDismissAttached = false;

  function checkMobileMenuTooltip() {
    try {
      const tooltip = document.getElementById("mobile-menu-tooltip");
      if (!tooltip) return;

      // يظهر التلميح في كل مرة يتم فيها تحميل المنصة على شاشات الموبايل
      if (window.innerWidth < 1024) {
        tooltip.classList.remove("hidden");
        if (window.lucide) lucide.createIcons();

        // مستمع عالمي للنقر واللمس على المستند لإخفاء التلميح فوراً عند أي لمسة
        if (!tooltipDismissAttached) {
          tooltipDismissAttached = true;
          const dismissGlobal = function(e) {
            dismissMenuTooltip();
            document.removeEventListener('click', dismissGlobal, true);
            document.removeEventListener('touchstart', dismissGlobal, true);
            tooltipDismissAttached = false;
          };

          // تفعيل المستمع بعد 100ms حتى لا يمسك حدث التحميل الأولي
          setTimeout(() => {
            document.addEventListener('click', dismissGlobal, true);
            document.addEventListener('touchstart', dismissGlobal, true);
          }, 100);
        }
      } else {
        tooltip.classList.add("hidden");
      }
    } catch (e) {
      console.warn("Tooltip check error:", e);
    }
  }

  function dismissMenuTooltip(event) {
    if (event && event.stopPropagation) event.stopPropagation();
    try {
      const tooltip = document.getElementById("mobile-menu-tooltip");
      if (tooltip) {
        tooltip.classList.add("hidden");
      }
    } catch (e) {
      console.warn("Tooltip dismiss error:", e);
    }
  }

  // مُولّد الأصوات عبر Web Audio API
  const AudioEffects = {
    ctx: null,
    init: function() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    },
    playSuccess: function() {
      if (!soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        osc.frequency.setValueAtTime(1046.50, now + 0.25);
        
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        
        osc.start(now);
        osc.stop(now + 0.45);
      } catch (e) {}
    },
    playError: function() {
      if (!soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(165, now + 0.12);
        
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
      } catch (e) {}
    },
    playClick: function() {
      if (!soundEnabled) return;
      try {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = "triangle";
        osc.frequency.setValueAtTime(750, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        
        osc.start(now);
        osc.stop(now + 0.04);
      } catch (e) {}
    }
  };

  // أدوات بناء وقراءة مسار الـ URL (Hash Router)
  function buildHash(view, params = {}) {
    const keys = Object.keys(params || {});
    if (keys.length === 0) return view;
    const searchParams = new URLSearchParams();
    for (const k of keys) {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        searchParams.set(k, params[k]);
      }
    }
    const q = searchParams.toString();
    return q ? `${view}?${q}` : view;
  }

  function parseHash() {
    let hash = (window.location.hash || '').replace(/^#/, '');
    
    // دعم إضافي لروابط Vercel المباشرة عبر Pathname (مثل /lessons أو /exams)
    if (!hash && window.location.pathname && window.location.pathname !== '/' && !window.location.pathname.endsWith('.html')) {
      const cleanPath = window.location.pathname.replace(/^\/|\/$/g, '');
      if (cleanPath) {
        hash = cleanPath + (window.location.search || '');
      }
    }

    if (!hash) return { view: 'home', params: {} };
    const [viewPart, queryPart] = hash.split('?');
    const params = {};
    if (queryPart) {
      const searchParams = new URLSearchParams(queryPart);
      for (const [k, v] of searchParams.entries()) {
        params[k] = v;
      }
    }
    return { view: viewPart || 'home', params };
  }

  // تهيئة التطبيق عند اكتمال تحميل الصفحة
  function init() {
    try {
      initTheme();
    } catch (e) {
      console.warn("Theme initialization error:", e);
    }

    try {
      bindGlobalEvents();
    } catch (e) {
      console.warn("Global events binding error:", e);
    }

    // إدارة زر الرجوع بالمتصفح والموبايل عبر PopState (آمنة تماماً بدون أخطاء)
    try {
      window.addEventListener('popstate', (event) => {
        try {
          // 1. إذا كانت نافذة منبثقة مفتوحة، نغلقها أولاً ونبقى في الصفحة
          if (activeModal) {
            closeGrammarModal(true /* fromBack */);
            return;
          }

          // 2. إذا انتقل المستخدم للخلف عبر التاريخ
          if (event.state && event.state.view) {
            renderView(event.state.view, event.state.params || {}, false /* pushHistory = false */);
          } else {
            const parsed = parseHash();
            if (parsed && parsed.view && parsed.view !== currentView) {
              renderView(parsed.view, parsed.params || {}, false);
            } else if (currentView !== 'home') {
              renderView('home', {}, false);
            }
          }
        } catch (popErr) {
          console.warn("Popstate handling error:", popErr);
        }
      });
    } catch (e) {
      console.warn("Popstate listener failed to attach:", e);
    }

    // استخراج المسار الابتدائي من الرابط
    try {
      const initialRoute = parseHash();
      const hash = buildHash(initialRoute.view || 'home', initialRoute.params || {});
      if (window.history && window.history.replaceState) {
        window.history.replaceState({ view: initialRoute.view || 'home', params: initialRoute.params || {} }, '', '#' + hash);
      }
      renderView(initialRoute.view || 'home', initialRoute.params || {}, false);
    } catch (e) {
      console.error("Initial routing error, fallback:", e);
      renderView('home', {}, false);
    }

    try {
      checkMobileMenuTooltip();
    } catch (e) {}

    try {
      updateNavBadge();
    } catch (e) {}
  }

  // إدارة الوضع الليلي والنهاري
  function initTheme() {
    const savedTheme = StorageManager.getTheme();
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
  }

  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
    StorageManager.saveTheme(nextTheme);
    updateThemeIcon(nextTheme);
  }

  function updateThemeIcon(theme) {
    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    if (theme === "dark") {
      btn.innerHTML = `<i data-lucide="sun" class="w-5 h-5 text-amber-400"></i>`;
    } else {
      btn.innerHTML = `<i data-lucide="moon" class="w-5 h-5 text-stone-700"></i>`;
    }
    if (window.lucide) lucide.createIcons();
  }

  // ربط أحداث القوائم والأزرار العامة
  function bindGlobalEvents() {
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) themeBtn.addEventListener("click", toggleTheme);

    const soundBtn = document.getElementById("sound-toggle-btn");
    if (soundBtn) {
      soundBtn.addEventListener("click", () => {
        soundEnabled = !soundEnabled;
        soundBtn.innerHTML = soundEnabled 
          ? `<i data-lucide="volume-2" class="w-5 h-5 text-emerald-600"></i>`
          : `<i data-lucide="volume-x" class="w-5 h-5 text-stone-400"></i>`;
        if (window.lucide) lucide.createIcons();
      });
    }

    // زر القائمة للموبايل
    const mobileMenuBtn = document.getElementById("mobile-menu-btn");
    const mobileMenu = document.getElementById("mobile-nav-drawer");
    if (mobileMenuBtn && mobileMenu) {
      mobileMenuBtn.addEventListener("click", () => {
        dismissMenuTooltip();
        mobileMenu.classList.toggle("hidden");
      });
    }

    // النقر على روابط القائمة
    document.querySelectorAll("[data-nav-target]").forEach(el => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const target = el.getAttribute("data-nav-target");
        renderView(target, {}, true);
        if (mobileMenu) mobileMenu.classList.add("hidden");
      });
    });

    // إغلاق النافذة المنبثقة عند الضغط على مفتاح Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeModal) {
        closeGrammarModal();
      }
    });
  }

  // موجه الصفحات (View Router) مع دعم History API والحماية من الانهيار
  function renderView(viewName, params = {}, pushHistory = true) {
    try {
      // إغلاق أي نافذة منبثقة عند الانتقال
      if (activeModal) {
        closeGrammarModal(true);
      }

      currentView = viewName || "home";
      currentParams = params || {};

      if (pushHistory) {
        try {
          const hash = buildHash(viewName, params);
          const currentHash = (window.location.hash || '').replace(/^#/, '');
          if (currentHash !== hash && window.history && window.history.pushState) {
            window.history.pushState({ view: viewName, params: params }, '', '#' + hash);
          }
        } catch (histErr) {
          console.warn("History pushState restricted:", histErr);
        }
      }

      try {
        AudioEffects.playClick();
      } catch (e) {}

      const container = document.getElementById("app-content");
      if (!container) return;

      // تنظيف مؤقت الامتحان إن وجد
      if (examTimerInterval) {
        clearInterval(examTimerInterval);
        examTimerInterval = null;
      }

      // تحديث الرابط النشط في القائمة
      try {
        document.querySelectorAll("[data-nav-target]").forEach(link => {
          const target = link.getAttribute("data-nav-target");
          if (target === viewName || 
             (viewName === 'lesson-detail' && target === 'lessons') ||
             (viewName === 'summary-detail' && target === 'summaries') ||
             (viewName === 'active-exam' && target === 'exams')) {
            link.classList.add("text-emerald-700", "dark:text-emerald-400", "font-bold", "border-b-2", "border-emerald-700");
          } else {
            link.classList.remove("text-emerald-700", "dark:text-emerald-400", "font-bold", "border-b-2", "border-emerald-700");
          }
        });
      } catch (navErr) {
        console.warn("Nav links error:", navErr);
      }

      let html = "";
      try {
        switch (viewName) {
          case "home":
            html = renderHomeView();
            break;
          case "lessons":
            html = renderLessonsView(params.category || "reading");
            break;
          case "lesson-detail":
            html = renderLessonDetailView(params.lessonId);
            break;
          case "curriculum-grammar":
            html = renderCurriculumGrammarView();
            break;
          case "previous-grammar":
            html = renderPreviousGrammarView();
            break;
          case "placement-test":
            html = renderPlacementTestView();
            break;
          case "random-quiz":
            html = renderRandomQuizView(params);
            break;
          case "question-bank":
            html = renderQuestionBankView();
            break;
          case "exams":
            html = renderExamsView();
            break;
          case "active-exam":
            html = renderActiveExamView(params.examId);
            break;
          case "summaries":
            html = renderSummariesView();
            break;
          case "summary-detail":
            html = renderSummaryDetailView(params.summaryId);
            break;
          case "vocabulary":
            html = renderVocabularyView();
            break;
          case "progress":
            html = renderProgressView();
            break;
          default:
            html = renderHomeView();
        }
      } catch (innerRenderErr) {
        console.error("View rendering error, fallback to home view:", innerRenderErr);
        html = renderHomeView();
      }

      container.innerHTML = `<div class="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">${html}</div>`;
      
      try {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {}

      try {
        if (window.lucide) lucide.createIcons();
      } catch (e) {}

      try {
        attachViewEvents(viewName, params);
      } catch (e) {}
    } catch (fatalErr) {
      console.error("Fatal renderView error caught:", fatalErr);
      const container = document.getElementById("app-content");
      if (container) {
        container.innerHTML = `<div class="p-8 text-center text-red-600 font-bold">حدث خطأ أثناء تحميل الصفحة، يرجى إعادة المحاولة.</div>`;
      }
    }
  }

  // ==========================================
  // الصفحة الرئيسية (Home View) - بتصميم نقي دون حشو
  // ==========================================
  function renderHomeView() {
    const stats = StorageManager.getOverallStats();
    
    return `
      <!-- بانر الترحيب الافتتاحي المنقح -->
      <section class="editorial-card p-6 md:p-10 mb-8 border-r-8 border-emerald-800 bg-gradient-to-l from-emerald-50/50 dark:from-emerald-950/20 to-transparent">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div class="space-y-4 max-w-3xl">
            <!-- العنوان الرئيسي فقط دون وسوم إضافية أو نصوص حشو مكررة -->
            <h1 class="text-2xl sm:text-3xl md:text-4xl font-black text-stone-900 dark:text-stone-100 leading-tight">
              اللغة العربية للصف الأول الثانوي الفني
            </h1>
            
            <div class="flex flex-wrap gap-3 pt-2">
              <button onclick="App.renderView('lessons', {category: 'reading'})" class="px-5 py-2.5 rounded-xl font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-md flex items-center gap-2 transition">
                <i data-lucide="book-open" class="w-4 h-4"></i> ابدأ دروس المنهج
              </button>
              <button onclick="App.renderView('placement-test')" class="px-5 py-2.5 rounded-xl font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-md flex items-center gap-2 transition">
                <i data-lucide="compass" class="w-4 h-4"></i> اختبار تحديد مستوى النحو
              </button>
              <button onclick="App.renderView('exams')" class="px-5 py-2.5 rounded-xl font-bold bg-stone-800 hover:bg-stone-900 text-white shadow-md flex items-center gap-2 transition">
                <i data-lucide="file-check-2" class="w-4 h-4"></i> نماذج الامتحانات النهائية
              </button>
            </div>
          </div>
          
          <!-- بطاقة الإحصائيات السريعة للطالب -->
          <div class="bg-white dark:bg-stone-800/90 p-5 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm w-full lg:w-80 shrink-0">
            <h3 class="text-sm font-bold text-stone-500 dark:text-stone-400 mb-3 flex items-center gap-2">
              <i data-lucide="activity" class="w-4 h-4 text-emerald-600"></i> مؤشرات إنجازك الدراسي
            </h3>
            <div class="space-y-4">
              <div>
                <div class="flex justify-between text-xs font-bold mb-1">
                  <span>إتمام منهج القراءة والنصوص</span>
                  <span class="text-emerald-700 dark:text-emerald-400">${stats.curriculumPercentage}%</span>
                </div>
                <div class="w-full h-2.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div class="h-full bg-emerald-600 rounded-full transition-all duration-500" style="width: ${stats.curriculumPercentage}%"></div>
                </div>
              </div>
              
              <div>
                <div class="flex justify-between text-xs font-bold mb-1">
                  <span>تأسيس النحو التراكمي</span>
                  <span class="text-amber-700 dark:text-amber-400">${stats.grammarPercentage}%</span>
                </div>
                <div class="w-full h-2.5 bg-stone-100 dark:bg-stone-700 rounded-full overflow-hidden">
                  <div class="h-full bg-amber-600 rounded-full transition-all duration-500" style="width: ${stats.grammarPercentage}%"></div>
                </div>
              </div>

              <div class="pt-3 border-t border-stone-100 dark:border-stone-700 grid grid-cols-2 gap-2 text-center">
                <div class="p-2 bg-stone-50 dark:bg-stone-900 rounded-xl">
                  <span class="text-xs text-stone-500 block">نقاط الخبرة XP</span>
                  <span class="text-lg font-black text-emerald-700 dark:text-emerald-400">${stats.xp}</span>
                </div>
                <div class="p-2 bg-stone-50 dark:bg-stone-900 rounded-xl">
                  <span class="text-xs text-stone-500 block">دقة الإجابات</span>
                  <span class="text-lg font-black text-amber-700 dark:text-amber-400">${stats.overallAccuracy}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- مسارات التعلم الأربعة الرئيسة -->
      <div class="mb-10">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-extrabold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <i data-lucide="compass" class="w-5 h-5 text-emerald-700"></i> أبواب المنهج الدراسي
          </h2>
          <span class="text-xs text-stone-500">الفصل الدراسي الأول</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <!-- 1. القراءة -->
          <div onclick="App.renderView('lessons', {category: 'reading'})" class="editorial-card p-5 cursor-pointer hover:border-emerald-700 group transition">
            <div class="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <i data-lucide="book-open" class="w-6 h-6"></i>
            </div>
            <h3 class="font-bold text-lg text-stone-900 dark:text-stone-100 mb-2">أولاً: دروس القراءة</h3>
            <p class="text-xs text-stone-500 dark:text-stone-400 mb-4 line-clamp-2">
              (أسس النجاح في الحياة • التعليم الفني والتنمية البشرية • التواصل الإنساني) بالنصوص الأصلية والمعاني.
            </p>
            <div class="text-xs font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              استكشف 3 موضوعات <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            </div>
          </div>

          <!-- 2. الأدب والنصوص -->
          <div onclick="App.renderView('lessons', {category: 'texts'})" class="editorial-card p-5 cursor-pointer hover:border-amber-700 group transition">
            <div class="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <i data-lucide="feather" class="w-6 h-6"></i>
            </div>
            <h3 class="font-bold text-lg text-stone-900 dark:text-stone-100 mb-2">ثانياً: الأدب والنصوص</h3>
            <p class="text-xs text-stone-500 dark:text-stone-400 mb-4 line-clamp-2">
              (وصية أم لابنتها • في الحكمة للبيد بن ربيعة • في الرثاء لعبد الله بن رواحة) مع البلاغة والأوزان.
            </p>
            <div class="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              استكشف 3 نصوص أدبية <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            </div>
          </div>

          <!-- 3. نحو المنهج وقواعد الإملاء -->
          <div onclick="App.renderView('curriculum-grammar')" class="editorial-card p-5 cursor-pointer hover:border-blue-700 group transition">
            <div class="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <i data-lucide="check-square" class="w-6 h-6"></i>
            </div>
            <h3 class="font-bold text-lg text-stone-900 dark:text-stone-100 mb-2">ثالثاً: نحو المنهج والكتابة</h3>
            <p class="text-xs text-stone-500 dark:text-stone-400 mb-4 line-clamp-2">
              الجملة الاسمية، كان وأخواتها، إن وأخواتها، وهمزة القطع وألف الوصل والهمزة المتوسطة.
            </p>
            <div class="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
              استكشف قواعد المنهج <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            </div>
          </div>

          <!-- 4. تأسيس النحو التراكمي -->
          <div onclick="App.renderView('previous-grammar')" class="editorial-card p-5 cursor-pointer hover:border-purple-700 group transition">
            <div class="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 flex items-center justify-center mb-4 group-hover:scale-110 transition">
              <i data-lucide="graduation-cap" class="w-6 h-6"></i>
            </div>
            <h3 class="font-bold text-lg text-stone-900 dark:text-stone-100 mb-2">رابعاً: النحو التأسيسي</h3>
            <p class="text-xs text-stone-500 dark:text-stone-400 mb-4 line-clamp-2">
              مسار مستقل من 12 مرحلة لإعادة بناء القواعد من الصفر مع اختبار تحديد المستوى وجداول الإعراب.
            </p>
            <div class="text-xs font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1">
              12 محطة تأسيسية <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
            </div>
          </div>
        </div>
      </div>

      <!-- أدوات التعلم المتقدمة -->
      <div class="editorial-card p-6 md:p-8 mb-10 bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800">
        <h2 class="text-xl font-bold mb-4 text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <i data-lucide="cpu" class="w-5 h-5 text-emerald-700"></i> منظومة التدريب الذكي والاختبارات
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div onclick="App.renderView('random-quiz')" class="p-4 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 cursor-pointer hover:shadow-md transition">
            <i data-lucide="shuffle" class="w-5 h-5 text-emerald-600 mb-2"></i>
            <h4 class="font-bold text-sm mb-1">مولد الاختبار العشوائي</h4>
            <p class="text-xs text-stone-500">حدد الدروس وعدد ونوع الأسئلة وتدرب مع التقييم والشرح الفوري.</p>
          </div>

          <div onclick="App.renderView('question-bank')" class="p-4 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 cursor-pointer hover:shadow-md transition">
            <i data-lucide="database" class="w-5 h-5 text-blue-600 mb-2"></i>
            <h4 class="font-bold text-sm mb-1">بنك الأسئلة الشامل</h4>
            <p class="text-xs text-stone-500">تصفح وجاوب تفاعلياً على مئات الأسئلة مع كشف الحل بعد الإجابة.</p>
          </div>

          <div onclick="App.renderView('vocabulary')" class="p-4 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 cursor-pointer hover:shadow-md transition">
            <i data-lucide="spell-check" class="w-5 h-5 text-amber-600 mb-2"></i>
            <h4 class="font-bold text-sm mb-1">معجم لغويات المنهج</h4>
            <p class="text-xs text-stone-500">ابحث عن أي مفردة من معاني الكلمات والجموع والمضادات في ثوانٍ.</p>
          </div>

          <div onclick="App.renderView('summaries')" class="p-4 bg-white dark:bg-stone-800 rounded-xl border border-stone-200 dark:border-stone-700 cursor-pointer hover:shadow-md transition">
            <i data-lucide="printer" class="w-5 h-5 text-purple-600 mb-2"></i>
            <h4 class="font-bold text-sm mb-1">ملخصات ليلة الامتحان</h4>
            <p class="text-xs text-stone-500">ملخصات موسعة وشاملة لكل موضوع وقاعدة مع جاهزية كاملة للطباعة.</p>
          </div>
        </div>
      </div>
    `;
  }

  // ==========================================
  // قائمة الدروس (Lessons View)
  // ==========================================
  function renderLessonsView(category = "reading") {
    const isReading = category === "reading";
    const lessonsList = isReading ? CurriculumData.reading : CurriculumData.texts;

    let itemsHtml = lessonsList.map(lesson => {
      const isDone = StorageManager.isLessonCompleted(lesson.id);
      return `
        <div onclick="App.renderView('lesson-detail', {lessonId: '${lesson.id}'})" class="editorial-card p-6 flex flex-col justify-between hover:border-emerald-600 cursor-pointer group transition">
          <div>
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${isReading ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}">
                ${isReading ? 'موضوع قراءة' : 'نص أدبي وبلاغي'} • ص ${lesson.page}
              </span>
              ${isDone ? `
                <span class="inline-flex items-center gap-1 text-xs text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-md">
                  <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> مكتمل
                </span>
              ` : `
                <span class="text-xs text-stone-400">قيد المذاكرة</span>
              `}
            </div>

            <h3 class="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">
              ${lesson.title}
            </h3>
            <p class="text-xs text-stone-500 dark:text-stone-400 mb-3">
              <span class="font-bold">المؤلف / الشاعر:</span> ${lesson.author} ${lesson.period ? `(${lesson.period})` : ''}
            </p>
            <p class="text-xs text-stone-600 dark:text-stone-300 leading-relaxed mb-4 line-clamp-3">
              ${isReading ? lesson.originalText.substring(0, 160) + "..." : (lesson.context || "دراسة بلاغية ونقدية شاملة للنص المقرر...")}
            </p>
          </div>

          <div class="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between" onclick="event.stopPropagation()">
            <button onclick="App.renderView('lesson-detail', {lessonId: '${lesson.id}'})" class="px-4 py-2 rounded-xl text-xs font-bold bg-stone-900 hover:bg-stone-800 dark:bg-stone-100 dark:text-stone-900 text-white flex items-center gap-1.5 transition">
              <i data-lucide="book-open" class="w-3.5 h-3.5"></i> دراسة الدرس كاملاً
            </button>
            <button onclick="App.startLessonQuiz('${lesson.id}')" class="px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 flex items-center gap-1 transition">
              <i data-lucide="zap" class="w-3.5 h-3.5"></i> اختبار سريع
            </button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100">دروس المنهج المقررة</h2>
          <p class="text-xs text-stone-500 mt-1">كتاب اللغة العربية - الصف الأول الثانوي الفني (الفصل الدراسي الأول)</p>
        </div>
        
        <div class="inline-flex p-1 bg-stone-200 dark:bg-stone-800 rounded-xl">
          <button onclick="App.renderView('lessons', {category: 'reading'})" class="px-4 py-2 rounded-lg text-xs font-bold transition ${isReading ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-600 dark:text-stone-400'}">
            القراءة (3 دروس)
          </button>
          <button onclick="App.renderView('lessons', {category: 'texts'})" class="px-4 py-2 rounded-lg text-xs font-bold transition ${!isReading ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm' : 'text-stone-600 dark:text-stone-400'}">
            الأدب والنصوص (3 نصوص)
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${itemsHtml}
      </div>
    `;
  }

  // ==========================================
  // صفحة تفاصيل الدرس (Lesson Detail View)
  // ==========================================
  function renderLessonDetailView(lessonId) {
    activeLessonId = lessonId;
    let lesson = CurriculumData.reading.find(l => l.id === lessonId);
    let isPoetry = false;
    if (!lesson) {
      lesson = CurriculumData.texts.find(l => l.id === lessonId);
      isPoetry = !!(lesson && lesson.verses);
    }
    if (!lesson) return `<p class="p-8 text-center text-red-600 font-bold">الدرس غير موجود!</p>`;

    const isDone = StorageManager.isLessonCompleted(lesson.id);

    let originalTextHtml = "";
    if (isPoetry && lesson.verses) {
      originalTextHtml = `
        <div class="space-y-4 arabic-poetry my-4">
          ${lesson.verses.map((v) => `
            <div class="poetry-verse">
              <span class="text-stone-800 dark:text-stone-200 text-base md:text-lg">${v.first}</span>
              <span class="verse-separator">۞</span>
              <span class="text-stone-800 dark:text-stone-200 text-base md:text-lg">${v.second}</span>
            </div>
          `).join("")}
        </div>
      `;
    } else {
      originalTextHtml = `
        <div class="bg-stone-50 dark:bg-stone-900/60 p-6 rounded-2xl border border-stone-200 dark:border-stone-800 text-base md:text-lg leading-relaxed text-stone-800 dark:text-stone-200 whitespace-pre-line font-serif">
          ${lesson.originalText}
        </div>
      `;
    }

    let vocabHtml = (lesson.vocabulary || []).map(v => `
      <tr class="hover:bg-stone-50 dark:hover:bg-stone-800/50">
        <td class="p-3 font-bold text-emerald-800 dark:text-emerald-400 whitespace-nowrap">${v.word}</td>
        <td class="p-3 text-stone-700 dark:text-stone-300">${v.meaning}</td>
      </tr>
    `).join("");

    let beautyHtml = "";
    if (lesson.literaryDevices) {
      const ld = lesson.literaryDevices;
      beautyHtml = `
        <div class="mt-8 space-y-6">
          <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <i data-lucide="sparkles" class="w-5 h-5 text-amber-600"></i> البلاغة ومواطن الجمال
          </h3>

          ${ld.images && ld.images.length > 0 ? `
            <div class="editorial-card p-5">
              <h4 class="font-bold text-sm text-emerald-700 dark:text-emerald-400 mb-3 flex items-center gap-1.5">
                <i data-lucide="image" class="w-4 h-4"></i> أولاً: الصور الخيالية والبيانية
              </h4>
              <div class="space-y-3">
                ${ld.images.map(img => `
                  <div class="p-3 rounded-xl bg-stone-50 dark:bg-stone-900 border-r-4 border-emerald-600">
                    <span class="font-bold text-stone-900 dark:text-stone-100 block mb-1">«${img.phrase}» (${img.type})</span>
                    <p class="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">${img.explanation}</p>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ''}

          ${ld.methods && ld.methods.length > 0 ? `
            <div class="editorial-card p-5">
              <h4 class="font-bold text-sm text-blue-700 dark:text-blue-400 mb-3 flex items-center gap-1.5">
                <i data-lucide="message-square" class="w-4 h-4"></i> ثانياً: الأساليب وأغراضها البلاغية
              </h4>
              <div class="space-y-3">
                ${ld.methods.map(m => `
                  <div class="p-3 rounded-xl bg-stone-50 dark:bg-stone-900 border-r-4 border-blue-600">
                    <span class="font-bold text-stone-900 dark:text-stone-100 block mb-1">«${m.phrase}» (${m.type})</span>
                    <p class="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">${m.explanation}</p>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ''}

          ${ld.badia && ld.badia.length > 0 ? `
            <div class="editorial-card p-5">
              <h4 class="font-bold text-sm text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                <i data-lucide="music" class="w-4 h-4"></i> ثالثاً: المحسنات البديعية
              </h4>
              <div class="space-y-3">
                ${ld.badia.map(b => `
                  <div class="p-3 rounded-xl bg-stone-50 dark:bg-stone-900 border-r-4 border-amber-600">
                    <span class="font-bold text-stone-900 dark:text-stone-100 block mb-1">«${b.phrase}» (${b.type})</span>
                    <p class="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">${b.explanation}</p>
                  </div>
                `).join("")}
              </div>
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <div class="mb-6 flex flex-wrap items-center justify-between gap-4">
        <button onclick="App.renderView('lessons', {category: '${lesson.unit === 'القراءة' ? 'reading' : 'texts'}'})" class="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition flex items-center gap-1">
          <i data-lucide="arrow-right" class="w-4 h-4"></i> العودة لقائمة الدروس
        </button>

        <div class="flex items-center gap-2">
          <button id="mark-complete-btn" onclick="App.markActiveLessonCompleted()" class="px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${isDone ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm'}">
            <i data-lucide="${isDone ? 'check-check' : 'check'}" class="w-4 h-4"></i>
            ${isDone ? 'تم إتمام هذا الدرس بنجاح' : 'تحديد الدرس كمكتمل (+50 XP)'}
          </button>
          
          <button onclick="App.startLessonQuiz('${lesson.id}')" class="px-4 py-2 rounded-xl text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white shadow-sm flex items-center gap-1.5 transition">
            <i data-lucide="zap" class="w-4 h-4"></i> بدء تدريب فوري
          </button>
        </div>
      </div>

      <div class="editorial-card p-6 md:p-8 mb-8 border-r-8 ${lesson.unit === 'القراءة' ? 'border-emerald-700' : 'border-amber-700'}">
        <div class="flex items-center gap-2 text-xs font-bold text-stone-500 mb-2">
          <span>${lesson.unit}</span> • <span>الصفحة ${lesson.page} بالكتاب المدرسي</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-black text-stone-900 dark:text-stone-100 mb-3">${lesson.title}</h1>
        <p class="text-sm font-semibold text-emerald-800 dark:text-emerald-400 mb-3">
          بقلم / ${lesson.author} ${lesson.period ? `(${lesson.period})` : ''}
        </p>
        ${lesson.context ? `
          <div class="p-3.5 bg-stone-100 dark:bg-stone-800/80 rounded-xl text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            <span class="font-bold text-stone-800 dark:text-stone-200">جو النص والمناسبة:</span> ${lesson.context}
          </div>
        ` : ''}
      </div>

      <div class="space-y-8">
        <div class="editorial-card p-6 md:p-8">
          <h2 class="text-xl font-bold mb-4 text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <i data-lucide="file-text" class="w-5 h-5 text-emerald-700"></i> النص الأصلي المعتمد بالكتاب الوزاري
          </h2>
          ${originalTextHtml}
        </div>

        <div class="editorial-card p-6 md:p-8">
          <h2 class="text-xl font-bold mb-4 text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <i data-lucide="spell-check" class="w-5 h-5 text-amber-700"></i> معجم اللغويات ومعاني الكلمات
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full text-xs md:text-sm text-right border-collapse">
              <thead>
                <tr class="bg-stone-100 dark:bg-stone-800 border-b border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300">
                  <th class="p-3 font-extrabold w-1/4">الكلمة والتعبير</th>
                  <th class="p-3 font-extrabold">المعنى والمضاد والمفرد والجمع</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-stone-100 dark:divide-stone-800">
                ${vocabHtml}
              </tbody>
            </table>
          </div>
        </div>

        <div class="editorial-card p-6 md:p-8">
          <h2 class="text-xl font-bold mb-4 text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <i data-lucide="lightbulb" class="w-5 h-5 text-blue-700"></i> الأفكار الرئيسة والشرح التحليلي
          </h2>
          
          <div class="mb-6">
            <h3 class="font-bold text-sm text-stone-800 dark:text-stone-200 mb-3">الأفكار المحورية:</h3>
            <ul class="space-y-2">
              ${(lesson.mainIdeas || []).map((idea, idx) => `
                <li class="flex items-start gap-2 text-xs md:text-sm text-stone-700 dark:text-stone-300">
                  <span class="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 font-bold flex items-center justify-center shrink-0 text-xs">${idx + 1}</span>
                  <span>${idea}</span>
                </li>
              `).join("")}
            </ul>
          </div>

          <div class="p-5 rounded-xl bg-stone-50 dark:bg-stone-900 text-xs md:text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line border-r-4 border-blue-600">
            ${lesson.explanation}
          </div>
        </div>

        ${beautyHtml}
      </div>
    `;
  }

  function markActiveLessonCompleted() {
    if (!activeLessonId) return;
    StorageManager.markLessonComplete(activeLessonId);
    AudioEffects.playSuccess();
    renderLessonDetailView(activeLessonId);
  }

  // ==========================================
  // نحو المنهج وقواعد الكتابة (Curriculum Grammar)
  // ==========================================
  function renderCurriculumGrammarView() {
    const grammarLessons = CurriculumData.curriculumGrammar;
    const spellingLessons = CurriculumData.spelling;

    let grammarCards = grammarLessons.map(item => `
      <div class="editorial-card p-6 mb-6">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-full">
            قواعد نحوية • ص ${item.page}
          </span>
          <button onclick="App.startLessonQuiz('${item.id}')" class="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
            <i data-lucide="zap" class="w-3.5 h-3.5"></i> اختبار القاعدة
          </button>
        </div>

        <h3 class="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">${item.title}</h3>
        <p class="text-xs md:text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-4 whitespace-pre-line bg-stone-50 dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-800">
          ${item.ruleSummary}
        </p>

        <div class="space-y-2 mb-4">
          <h4 class="text-xs font-bold text-stone-500 uppercase">الضوابط والتقسيمات الدقيقة:</h4>
          <ul class="space-y-1.5">
            ${item.keyPoints.map(kp => `
              <li class="text-xs text-stone-700 dark:text-stone-300 flex items-start gap-2">
                <i data-lucide="check" class="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5"></i>
                <span>${kp}</span>
              </li>
            `).join("")}
          </ul>
        </div>

        ${item.solvedExercises ? `
          <div class="pt-4 border-t border-stone-100 dark:border-stone-800">
            <h4 class="text-xs font-bold text-emerald-800 dark:text-emerald-400 mb-2 flex items-center gap-1">
              <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> نماذج إعرابية وتدريبات محلولة بالكتاب:
            </h4>
            <div class="space-y-2 text-xs">
              ${item.solvedExercises.map(ex => `
                <div class="p-3 bg-white dark:bg-stone-800 rounded-lg border border-stone-200 dark:border-stone-700">
                  <div class="font-bold text-stone-900 dark:text-stone-100 mb-1">${ex.sentence || ex.question}</div>
                  ${ex.answer ? `<div class="text-stone-600 dark:text-stone-300 whitespace-pre-line">${ex.answer}</div>` : ''}
                  ${ex.breakdown ? `
                    <div class="space-y-1 mt-1 text-stone-600 dark:text-stone-300">
                      ${ex.breakdown.map(b => `<div><span class="font-bold text-blue-700 dark:text-blue-400">«${b.part}»:</span> ${b.role}</div>`).join("")}
                    </div>
                  ` : ''}
                </div>
              `).join("")}
            </div>
          </div>
        ` : ''}
      </div>
    `).join("");

    let spellingCards = spellingLessons.map(item => `
      <div class="editorial-card p-6 mb-6">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded-full">
            قواعد الإملاء والكتابة • ص ${item.page}
          </span>
          <button onclick="App.startLessonQuiz('${item.id}')" class="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1">
            <i data-lucide="zap" class="w-3.5 h-3.5"></i> اختبار القاعدة
          </button>
        </div>

        <h3 class="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">${item.title}</h3>
        <p class="text-xs md:text-sm text-stone-600 dark:text-stone-300 leading-relaxed mb-4 whitespace-pre-line bg-stone-50 dark:bg-stone-900 p-4 rounded-xl border border-stone-200 dark:border-stone-800">
          ${item.ruleSummary}
        </p>

        <div class="space-y-1.5">
          ${item.keyPoints.map(kp => `
            <div class="text-xs text-stone-700 dark:text-stone-300 flex items-start gap-2">
              <i data-lucide="check" class="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5"></i>
              <span>${kp}</span>
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");

    return `
      <div class="mb-8">
        <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100">نحو المنهج وقواعد الكتابة</h2>
        <p class="text-xs text-stone-500 mt-1">الموضوعات المقررة حصرياً في كتاب الوزارة للفصل الدراسي الأول</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 class="text-lg font-bold text-stone-800 dark:text-stone-200 mb-4 flex items-center gap-2">
            <i data-lucide="book-marked" class="w-5 h-5 text-blue-700"></i> موضوعات النحو المقررة
          </h3>
          ${grammarCards}
        </div>

        <div>
          <h3 class="text-lg font-bold text-stone-800 dark:text-stone-200 mb-4 flex items-center gap-2">
            <i data-lucide="pen-tool" class="w-5 h-5 text-amber-700"></i> قواعد الإملاء والرسم الكتابي
          </h3>
          ${spellingCards}
        </div>
      </div>
    `;
  }

  // ==========================================
  // النحو التأسيسي التراكمي (Previous Grammar)
  // جعل البطاقات كاملة قابلة للنقر + تصميم نافذة عريضة وراقية
  // ==========================================
  function renderPreviousGrammarView() {
    const pg = PreviousGrammarData;

    let stagesHtml = pg.stages.map(st => {
      const isDone = (StorageManager.getState().completedGrammarStages || []).includes(st.id);
      return `
        <!-- البطاقة بأكملها قابلة للنقر لفتح المحتوى مباشرة -->
        <div onclick="App.openGrammarModal('${st.id}')" class="editorial-card p-6 flex flex-col justify-between hover:border-purple-600 cursor-pointer group transition-all duration-200 hover:shadow-md">
          <div>
            <div class="flex items-center justify-between mb-3">
              <span class="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold flex items-center justify-center text-sm shadow-sm group-hover:scale-105 transition">
                ${st.number}
              </span>
              <span class="text-xs font-semibold px-2.5 py-1 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 text-stone-400'}">
                ${isDone ? 'مكتمل ✓' : st.level}
              </span>
            </div>

            <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 mb-2 group-hover:text-purple-700 dark:group-hover:text-purple-400 transition">${st.title}</h3>
            <p class="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-4 line-clamp-3">
              ${st.introduction}
            </p>
          </div>

          <div class="pt-4 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between" onclick="event.stopPropagation()">
            <button type="button" onclick="App.openGrammarModal('${st.id}')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-purple-700 hover:bg-purple-800 text-white flex items-center gap-1 transition shadow-sm">
              <i data-lucide="book-open" class="w-3.5 h-3.5"></i> الشرح والإعراب
            </button>
            <button type="button" onclick="App.toggleGrammarStageDone('${st.id}')" class="text-xs font-semibold p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition ${isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 hover:text-stone-600'}">
              ${isDone ? 'إلغاء الإتمام' : 'تحديد كمكتمل'}
            </button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <!-- بانر التأسيس النحوي -->
      <div class="editorial-card p-6 md:p-8 mb-8 bg-gradient-to-l from-purple-50/60 dark:from-purple-950/20 to-transparent border-r-8 border-purple-800">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div class="space-y-2">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
              <i data-lucide="compass" class="w-3.5 h-3.5"></i> بناء الملكة الإعرابية من الصفر
            </div>
            <h2 class="text-2xl md:text-3xl font-extrabold text-stone-900 dark:text-stone-100">${pg.title}</h2>
            <p class="text-xs md:text-sm text-stone-600 dark:text-stone-300 max-w-2xl leading-relaxed">
              ${pg.description}
            </p>
          </div>

          <div class="flex flex-col sm:flex-row gap-3">
            <button onclick="App.renderView('placement-test')" class="px-5 py-2.5 rounded-xl font-bold bg-purple-800 hover:bg-purple-900 text-white text-xs shadow-md flex items-center gap-2 transition">
              <i data-lucide="check-circle-2" class="w-4 h-4"></i> اختبار تحديد مستواك النحوي
            </button>
          </div>
        </div>
      </div>

      <!-- شبكة المراحل الـ 12 -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${stagesHtml}
      </div>
    `;
  }

  // فتح نافذة تفاصيل مرحلة النحو في وضع الشاشة العريضة
  function openGrammarModal(stageId) {
    try {
      const stage = PreviousGrammarData.stages.find(s => s.id === stageId);
      if (!stage) return;
      const modal = document.getElementById("grammar-stage-modal");
      const content = document.getElementById("grammar-modal-content");
      const header = document.getElementById("grammar-modal-header");
      if (!modal || !content) return;

      activeModal = { type: 'grammar', id: stageId };
      
      // تسجيل الحالة في الـ History ليعمل زر الرجوع بالمتصفح والموبايل في إغلاقها بسلاسة
      try {
        if (window.history && window.history.pushState) {
          window.history.pushState(
            { view: currentView, params: currentParams, modal: 'grammar', stageId },
            '',
            '#' + buildHash(currentView, currentParams) + '?stage=' + stageId
          );
        }
      } catch (histErr) {
        console.warn("History pushState for modal failed:", histErr);
      }

    // بناء الترويسة
    if (header) {
      header.innerHTML = `
        <span class="w-8 h-8 rounded-xl bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-black flex items-center justify-center text-sm shadow-sm">
          ${stage.number}
        </span>
        <div>
          <h3 class="text-base sm:text-lg font-black text-stone-900 dark:text-stone-100">${stage.title}</h3>
          <span class="text-xs text-purple-700 dark:text-purple-400 font-semibold">${stage.level} • تأسيس النحو التراكمي</span>
        </div>
      `;
    }

    let solvedTableHtml = "";
    if (stage.solvedExamples && stage.solvedExamples.length > 0) {
      solvedTableHtml = `
        <div class="mt-8">
          <h4 class="font-bold text-base text-purple-800 dark:text-purple-400 mb-4 flex items-center gap-2">
            <i data-lucide="table" class="w-5 h-5"></i> نماذج الإعراب التطبيقي النموذجي:
          </h4>
          ${stage.solvedExamples.map(ex => `
            <div class="mb-6 p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
              <span class="font-bold text-sm text-stone-800 dark:text-stone-200 block mb-3">الجملة: «${ex.sentence}»</span>
              <div class="overflow-x-auto">
                <table class="parsing-table text-xs md:text-sm">
                  <thead>
                    <tr>
                      <th class="w-1/4">الكلمة</th>
                      <th>نوعها</th>
                      <th>الموقع الإعرابي</th>
                      <th>العلامة وتوجيهها</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${ex.table.map(row => `
                      <tr>
                        <td class="font-bold text-emerald-800 dark:text-emerald-400">${row.word}</td>
                        <td>${row.type}</td>
                        <td class="font-semibold">${row.role}</td>
                        <td>${row.mark}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            </div>
          `).join("")}
        </div>
      `;
    }

    content.innerHTML = `
      <!-- المقدمة والمدخل السهل -->
      <div class="p-5 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
        <h4 class="text-xs font-bold text-purple-900 dark:text-purple-300 mb-2 flex items-center gap-1.5">
          <i data-lucide="sparkles" class="w-4 h-4"></i> مدخل وتوضيح مبسط:
        </h4>
        <p class="text-sm md:text-base text-stone-700 dark:text-stone-300 leading-relaxed">
          ${stage.introduction}
        </p>
      </div>

      <!-- التفكيك النظري للقواعد -->
      <div class="space-y-4">
        <h4 class="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
          <i data-lucide="layers" class="w-5 h-5 text-purple-700"></i> تفكيك القواعد والضوابط الدقيقة:
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${stage.breakdown.map(b => `
            <div class="p-4 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-800/60 space-y-2">
              <span class="font-extrabold text-sm text-purple-800 dark:text-purple-400 block border-b pb-1 border-stone-100 dark:border-stone-700">
                【 ${b.concept} 】
              </span>
              <p class="text-xs md:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">${b.rule}</p>
              <div class="pt-2 text-xs text-stone-500 border-t border-stone-100 dark:border-stone-700">
                <span class="font-bold text-stone-700 dark:text-stone-300">الأمارات والعلامات:</span> ${b.signs}
              </div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- أمثلة سهلة تمهيدية -->
      ${stage.easyExamples && stage.easyExamples.length > 0 ? `
        <div class="p-4 rounded-2xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-800">
          <h4 class="font-bold text-xs text-stone-500 uppercase mb-2">أمثلة تمهيدية سريعة:</h4>
          <ul class="space-y-1.5">
            ${stage.easyExamples.map(e => `
              <li class="text-xs md:text-sm text-stone-700 dark:text-stone-300 flex items-start gap-2">
                <i data-lucide="arrow-left" class="w-3.5 h-3.5 text-emerald-600 mt-1 shrink-0"></i>
                <span>${e}</span>
              </li>
            `).join("")}
          </ul>
        </div>
      ` : ''}

      <!-- جداول الإعراب -->
      ${solvedTableHtml}

      <!-- الأخطاء الشائعة -->
      ${stage.commonMistakes && stage.commonMistakes.length > 0 ? `
        <div class="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 space-y-3">
          <h4 class="font-bold text-sm text-amber-900 dark:text-amber-300 flex items-center gap-2">
            <i data-lucide="alert-triangle" class="w-4 h-4"></i> أخطاء ومصائد نحوية يقع فيها كثير من الطلاب:
          </h4>
          ${stage.commonMistakes.map(m => `
            <div class="text-xs md:text-sm text-stone-700 dark:text-stone-300 p-3 bg-white/80 dark:bg-stone-900/80 rounded-xl space-y-1">
              <div><span class="text-red-700 dark:text-red-400 font-bold">الخطأ الشائع:</span> ${m.mistake}</div>
              <div><span class="text-emerald-700 dark:text-emerald-400 font-bold">التصويب والتعليل:</span> ${m.correction}</div>
            </div>
          `).join("")}
        </div>
      ` : ''}

      <!-- أزرار الإجراءات السريعة -->
      <div class="pt-6 border-t border-stone-200 dark:border-stone-800 flex flex-wrap items-center justify-between gap-3">
        <button onclick="App.toggleGrammarStageDone('${stage.id}'); App.closeGrammarModal();" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-md flex items-center gap-1.5 transition">
          <i data-lucide="check" class="w-4 h-4"></i> تحديد هذه المرحلة كمكتملة (+40 XP)
        </button>
        <button onclick="App.closeGrammarModal()" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition">
          إغلاق النافذة
        </button>
      </div>
    `;

    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    if (window.lucide) lucide.createIcons();
  } catch (err) {
    console.error("Error opening grammar modal:", err);
  }
}

function closeGrammarModal(fromBack = false) {
  try {
    const modal = document.getElementById("grammar-stage-modal");
    if (modal) modal.classList.add("hidden");
    document.body.style.overflow = "";
    
    if (activeModal) {
      activeModal = null;
      if (!fromBack) {
        try {
          if (window.history && window.history.back) {
            window.history.back();
          }
        } catch (e) {
          console.warn("History back failed:", e);
        }
      }
    }
  } catch (err) {
    console.error("Error closing grammar modal:", err);
  }
}

  function toggleGrammarStageDone(stageId) {
    try {
      const state = StorageManager.getState();
      const isDone = (state.completedGrammarStages || []).includes(stageId);
      if (isDone) {
        state.completedGrammarStages = state.completedGrammarStages.filter(id => id !== stageId);
        try {
          localStorage.setItem("arabic_platform_student_state_v1", JSON.stringify(state));
        } catch (e) {
          console.warn("Storage error:", e);
        }
      } else {
        StorageManager.markGrammarStageComplete(stageId);
        AudioEffects.playSuccess();
      }
      renderView("previous-grammar", {}, false);
    } catch (e) {
      console.error("toggleGrammarStageDone error:", e);
    }
  }

  // ==========================================
  // قسم الملخصات الشاملة (Summaries Overhaul)
  // ملخصات موسعة وموثقة مع إمكانية عرض كل ملخص وطباعته
  // ==========================================
  function renderSummariesView() {
    return `
      <div class="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100">ملخصات المنهج الشاملة (ليلة الامتحان)</h2>
          <p class="text-xs text-stone-500 mt-1">اضغط على أي درس للاطلاع على ملخصه المفصل؛ شاملاً المعاني، الأفكار، البلاغة، والقواعد.</p>
        </div>
        <button onclick="window.print()" class="px-4 py-2 rounded-xl text-xs font-bold bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 flex items-center gap-1.5 transition">
          <i data-lucide="printer" class="w-4 h-4"></i> طباعة الملخص العام
        </button>
      </div>

      <div class="space-y-10">
        <!-- 1. ملخصات دروس القراءة -->
        <div>
          <h3 class="text-lg font-bold text-emerald-800 dark:text-emerald-400 mb-4 flex items-center gap-2">
            <i data-lucide="book-open" class="w-5 h-5"></i> أولاً: ملخصات موضوعات القراءة
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            ${CurriculumData.reading.map(r => `
              <div onclick="App.renderView('summary-detail', {summaryId: '${r.id}'})" class="editorial-card p-5 cursor-pointer hover:border-emerald-600 transition flex flex-col justify-between group">
                <div>
                  <span class="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
                    قراءة • ص ${r.page}
                  </span>
                  <h4 class="font-extrabold text-base text-stone-900 dark:text-stone-100 mt-2 mb-2 group-hover:text-emerald-700 transition">
                    ${r.title}
                  </h4>
                  <ul class="text-xs text-stone-600 dark:text-stone-300 space-y-1.5 mb-4">
                    <li class="flex items-start gap-1"><span class="text-emerald-600 font-bold">•</span> ${r.mainIdeas[0]}</li>
                    <li class="flex items-start gap-1"><span class="text-emerald-600 font-bold">•</span> ${r.mainIdeas[1]}</li>
                  </ul>
                </div>
                <div class="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  <span>عرض الملخص الشامل</span>
                  <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition"></i>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- 2. ملخصات الأدب والنصوص -->
        <div>
          <h3 class="text-lg font-bold text-amber-800 dark:text-amber-400 mb-4 flex items-center gap-2">
            <i data-lucide="feather" class="w-5 h-5"></i> ثانياً: ملخصات الأدب والنصوص والبلاغة
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            ${CurriculumData.texts.map(t => `
              <div onclick="App.renderView('summary-detail', {summaryId: '${t.id}'})" class="editorial-card p-5 cursor-pointer hover:border-amber-600 transition flex flex-col justify-between group">
                <div>
                  <span class="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded">
                    ${t.genre} • ${t.period}
                  </span>
                  <h4 class="font-extrabold text-base text-stone-900 dark:text-stone-100 mt-2 mb-2 group-hover:text-amber-700 transition">
                    ${t.title}
                  </h4>
                  <ul class="text-xs text-stone-600 dark:text-stone-300 space-y-1.5 mb-4">
                    <li class="flex items-start gap-1"><span class="text-amber-600 font-bold">•</span> ${t.mainIdeas[0]}</li>
                    <li class="flex items-start gap-1"><span class="text-amber-600 font-bold">•</span> ${t.mainIdeas[1] || t.mainIdeas[0]}</li>
                  </ul>
                </div>
                <div class="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
                  <span>عرض المعاني ومواطن الجمال</span>
                  <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition"></i>
                </div>
              </div>
            `).join("")}
          </div>
        </div>

        <!-- 3. ملخصات النحو وقواعد الإملاء -->
        <div>
          <h3 class="text-lg font-bold text-blue-800 dark:text-blue-400 mb-4 flex items-center gap-2">
            <i data-lucide="check-square" class="w-5 h-5"></i> ثالثاً: ملخصات نحو المنهج وقواعد الإملاء
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
            ${[...CurriculumData.curriculumGrammar, ...CurriculumData.spelling].map(g => `
              <div onclick="App.renderView('summary-detail', {summaryId: '${g.id}'})" class="editorial-card p-5 cursor-pointer hover:border-blue-600 transition flex flex-col justify-between group">
                <div>
                  <span class="text-[11px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded">
                    ${g.unit} • ص ${g.page}
                  </span>
                  <h4 class="font-extrabold text-base text-stone-900 dark:text-stone-100 mt-2 mb-2 group-hover:text-blue-700 transition">
                    ${g.title}
                  </h4>
                  <p class="text-xs text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-2 mb-3">
                    ${g.ruleSummary.substring(0, 100)}...
                  </p>
                </div>
                <div class="pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-400">
                  <span>عرض القاعدة والشواهد</span>
                  <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition"></i>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  // عرض تفصيلي وموسع لملخص درس بعينه مع دعم الطباعة
  function renderSummaryDetailView(summaryId) {
    let item = CurriculumData.reading.find(r => r.id === summaryId) ||
               CurriculumData.texts.find(t => t.id === summaryId) ||
               CurriculumData.curriculumGrammar.find(g => g.id === summaryId) ||
               CurriculumData.spelling.find(s => s.id === summaryId);

    if (!item) {
      return `<div class="p-8 text-center text-red-600">الملخص المطلوب غير متوفر.</div>`;
    }

    const isReadingOrText = item.unit === "القراءة" || item.unit === "الأدب والنصوص" || !!item.verses;

    return `
      <div class="max-w-4xl mx-auto space-y-6">
        <!-- شريط الرجوع والإجراءات -->
        <div class="flex items-center justify-between">
          <button onclick="App.renderView('summaries')" class="px-4 py-2 rounded-xl text-xs font-bold bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-300 transition flex items-center gap-1.5">
            <i data-lucide="arrow-right" class="w-4 h-4"></i> العودة لكافة الملخصات
          </button>
          
          <button onclick="window.print()" class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow flex items-center gap-1.5 transition">
            <i data-lucide="printer" class="w-4 h-4"></i> طباعة هذا الملخص
          </button>
        </div>

        <!-- رأس بطاقة الملخص -->
        <div class="editorial-card p-6 md:p-8 border-r-8 border-emerald-700 bg-gradient-to-l from-emerald-50/50 dark:from-emerald-950/20 to-transparent">
          <span class="text-xs font-bold text-stone-500">${item.unit} • الصفحة ${item.page} بالكتاب المدرسي</span>
          <h1 class="text-2xl md:text-3xl font-black text-stone-900 dark:text-stone-100 mt-2 mb-2">
            ملخص شامل: ${item.title}
          </h1>
          <p class="text-xs md:text-sm text-emerald-800 dark:text-emerald-400 font-semibold">
            ${item.author ? `إعداد وتأليف: ${item.author}` : 'مقرر وزارة التربية والتعليم للتعليم الفني'}
          </p>
        </div>

        ${isReadingOrText ? `
          <!-- 1. الأفكار الرئيسية -->
          <div class="editorial-card p-6 md:p-8 space-y-4">
            <h3 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <i data-lucide="list-ordered" class="w-5 h-5 text-emerald-600"></i> الأفكار الرئيسية المستخلصة
            </h3>
            <div class="space-y-2.5">
              ${(item.mainIdeas || []).map((idea, i) => `
                <div class="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 flex items-start gap-3 text-xs md:text-sm text-stone-700 dark:text-stone-300">
                  <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black flex items-center justify-center shrink-0 text-xs">${i + 1}</span>
                  <span class="leading-relaxed">${idea}</span>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- 2. معجم اللغويات والمفردات الوزارية -->
          <div class="editorial-card p-6 md:p-8 space-y-4">
            <h3 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <i data-lucide="spell-check" class="w-5 h-5 text-amber-600"></i> معجم المفردات واللغويات المقررة بالامتحان
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-xs md:text-sm text-right border-collapse">
                <thead>
                  <tr class="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                    <th class="p-3 font-extrabold w-1/3">الكلمة والتعبير</th>
                    <th class="p-3 font-extrabold">المعنى والمضاد والمفرد والجمع</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-stone-100 dark:divide-stone-800">
                  ${(item.vocabulary || []).map(v => `
                    <tr>
                      <td class="p-3 font-bold text-emerald-800 dark:text-emerald-400">${v.word}</td>
                      <td class="p-3 text-stone-700 dark:text-stone-300 leading-relaxed">${v.meaning}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>

          <!-- 3. مواطن الجمال والبلاغة (إن وجدت) -->
          ${item.literaryDevices ? `
            <div class="editorial-card p-6 md:p-8 space-y-6">
              <h3 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <i data-lucide="sparkles" class="w-5 h-5 text-amber-600"></i> مواطن الجمال والبلاغة ليلة الامتحان
              </h3>
              
              ${item.literaryDevices.images && item.literaryDevices.images.length > 0 ? `
                <div>
                  <h4 class="font-bold text-xs text-stone-500 uppercase mb-3">الصور الخيالية والاستعارات:</h4>
                  <div class="space-y-2">
                    ${item.literaryDevices.images.map(img => `
                      <div class="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border-r-4 border-emerald-600 text-xs">
                        <span class="font-bold text-stone-900 dark:text-stone-100 block mb-0.5">«${img.phrase}» (${img.type})</span>
                        <p class="text-stone-600 dark:text-stone-400">${img.explanation}</p>
                      </div>
                    `).join("")}
                  </div>
                </div>
              ` : ''}

              ${item.literaryDevices.methods && item.literaryDevices.methods.length > 0 ? `
                <div>
                  <h4 class="font-bold text-xs text-stone-500 uppercase mb-3">الأساليب وأغراضها البلاغية:</h4>
                  <div class="space-y-2">
                    ${item.literaryDevices.methods.map(m => `
                      <div class="p-3 rounded-xl bg-stone-50 dark:bg-stone-900/60 border-r-4 border-blue-600 text-xs">
                        <span class="font-bold text-stone-900 dark:text-stone-100 block mb-0.5">«${m.phrase}» (${m.type})</span>
                        <p class="text-stone-600 dark:text-stone-400">${m.explanation}</p>
                      </div>
                    `).join("")}
                  </div>
                </div>
              ` : ''}
            </div>
          ` : ''}
        ` : `
          <!-- عرض ملخص النحو وقواعد الإملاء الموسع -->
          <div class="editorial-card p-6 md:p-8 space-y-6">
            <h3 class="text-base md:text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <i data-lucide="book-marked" class="w-5 h-5 text-blue-600"></i> تلخيص وضوابط القاعدة النحوية/الإملائية
            </h3>
            
            <div class="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-xs md:text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line font-medium">
              ${item.ruleSummary}
            </div>

            <div class="space-y-3">
              <h4 class="font-bold text-xs text-stone-500 uppercase">كيفية تطبيق واستخراج القاعدة خطوة بخطوة:</h4>
              <div class="space-y-2">
                ${(item.keyPoints || []).map(kp => `
                  <div class="p-3 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300 flex items-start gap-2">
                    <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600 mt-0.5 shrink-0"></i>
                    <span>${kp}</span>
                  </div>
                `).join("")}
              </div>
            </div>

            ${item.solvedExercises ? `
              <div class="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
                <h4 class="font-bold text-xs text-stone-500 uppercase">شواهد ونماذج إعراب نموذجية محلولة:</h4>
                <div class="space-y-3">
                  ${item.solvedExercises.map(ex => `
                    <div class="p-4 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-xs space-y-2">
                      <div class="font-extrabold text-stone-900 dark:text-stone-100">${ex.sentence || ex.question}</div>
                      ${ex.answer ? `<div class="text-stone-600 dark:text-stone-300 whitespace-pre-line">${ex.answer}</div>` : ''}
                      ${ex.breakdown ? `
                        <div class="space-y-1 mt-2">
                          ${ex.breakdown.map(b => `
                            <div><span class="font-bold text-blue-700 dark:text-blue-400">«${b.part}»:</span> ${b.role}</div>
                          `).join("")}
                        </div>
                      ` : ''}
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : ''}
          </div>
        `}
      </div>
    `;
  }

  // ==========================================
  // بنك الأسئلة التفاعلي الشامل (Question Bank Interactive)
  // يعرض السؤال غير محلول، ويسمح باختيار الإجابة، ثم التحقق وكشف التعليل
  // ==========================================
  function renderQuestionBankView() {
    // حساب الإحصائيات الحالية للبنك
    const totalQuestions = QuestionBankData.length;
    let answeredCount = 0;
    let correctCount = 0;
    Object.keys(qbState.answers).forEach(qid => {
      const ans = qbState.answers[qid];
      if (ans && ans.isSubmitted) {
        answeredCount++;
        const q = QuestionBankData.find(item => item.id === qid);
        if (q && ans.selectedIndex === q.correctIndex) {
          correctCount++;
        }
      }
    });

    const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

    return `
      <!-- شريط معلومات بنك الأسئلة التفاعلي -->
      <div class="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100">بنك الأسئلة التفاعلي الشامل</h2>
          <p class="text-xs text-stone-500 mt-1">تدرب بنفسك: اختر الإجابة ثم اضغط «تحقق من الإجابة» لاكتشاف النتيجة وقراءة التعليل.</p>
        </div>

        <div class="flex items-center gap-3">
          <div class="px-3.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-xs font-bold text-stone-700 dark:text-stone-300">
            تم حل: <span class="text-emerald-700 dark:text-emerald-400">${answeredCount}</span> / ${totalQuestions} 
            ${answeredCount > 0 ? `(${accuracy}% دقة)` : ''}
          </div>
          <button onclick="App.resetQbAnswers()" class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-stone-200 hover:bg-stone-300 dark:bg-stone-700 text-stone-700 dark:text-stone-200 transition" title="إعادة تعيين كافة الإجابات">
            إعادة تعيين
          </button>
        </div>
      </div>

      <!-- أدوات الفلترة -->
      <div class="editorial-card p-4 mb-6 flex flex-wrap gap-3 items-center justify-between">
        <div class="flex flex-wrap gap-2 text-xs font-bold w-full sm:w-auto">
          <select id="qb-filter-lesson" onchange="App.handleQbFilterChange()" class="p-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl">
            <option value="all" ${qbState.filterLesson === 'all' ? 'selected' : ''}>جميع الموضوعات والدروس</option>
            ${CurriculumData.reading.map(l => `<option value="${l.id}" ${qbState.filterLesson === l.id ? 'selected' : ''}>[قراءة] ${l.title}</option>`).join("")}
            ${CurriculumData.texts.map(l => `<option value="${l.id}" ${qbState.filterLesson === l.id ? 'selected' : ''}>[نصوص] ${l.title}</option>`).join("")}
            ${CurriculumData.curriculumGrammar.map(l => `<option value="${l.id}" ${qbState.filterLesson === l.id ? 'selected' : ''}>[نحو] ${l.title}</option>`).join("")}
            ${CurriculumData.spelling.map(l => `<option value="${l.id}" ${qbState.filterLesson === l.id ? 'selected' : ''}>[إملاء] ${l.title}</option>`).join("")}
          </select>

          <select id="qb-filter-type" onchange="App.handleQbFilterChange()" class="p-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl">
            <option value="all" ${qbState.filterType === 'all' ? 'selected' : ''}>جميع أنواع الأسئلة</option>
            <option value="mcq" ${qbState.filterType === 'mcq' ? 'selected' : ''}>اختيار من متعدد</option>
            <option value="tf" ${qbState.filterType === 'tf' ? 'selected' : ''}>صح أو خطأ</option>
            <option value="complete" ${qbState.filterType === 'complete' ? 'selected' : ''}>أكمل الفراغ</option>
          </select>

          <select id="qb-filter-diff" onchange="App.handleQbFilterChange()" class="p-2.5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl">
            <option value="all" ${qbState.filterDiff === 'all' ? 'selected' : ''}>جميع مستويات الصعوبة</option>
            <option value="سهل" ${qbState.filterDiff === 'سهل' ? 'selected' : ''}>سهل</option>
            <option value="متوسط" ${qbState.filterDiff === 'متوسط' ? 'selected' : ''}>متوسط</option>
            <option value="صعب" ${qbState.filterDiff === 'صعب' ? 'selected' : ''}>صعب</option>
          </select>
        </div>
      </div>

      <!-- قائمة الأسئلة التفاعلية -->
      <div id="qb-items-container" class="space-y-5">
        ${renderQuestionBankItems()}
      </div>
    `;
  }

  function handleQbFilterChange() {
    qbState.filterLesson = document.getElementById("qb-filter-lesson")?.value || "all";
    qbState.filterType = document.getElementById("qb-filter-type")?.value || "all";
    qbState.filterDiff = document.getElementById("qb-filter-diff")?.value || "all";

    const container = document.getElementById("qb-items-container");
    if (container) {
      container.innerHTML = renderQuestionBankItems();
      if (window.lucide) lucide.createIcons();
    }
  }

  function renderQuestionBankItems() {
    let items = QuestionBankData;
    if (qbState.filterLesson !== "all") items = items.filter(q => q.lessonId === qbState.filterLesson);
    if (qbState.filterType !== "all") items = items.filter(q => q.type === qbState.filterType);
    if (qbState.filterDiff !== "all") items = items.filter(q => q.difficulty === qbState.filterDiff);

    if (items.length === 0) {
      return `<div class="editorial-card p-12 text-center text-stone-400 text-sm">لا توجد أسئلة تطابق الفلاتر المحددة.</div>`;
    }

    return items.map((q, idx) => {
      const qState = qbState.answers[q.id] || { selectedIndex: null, isSubmitted: false };
      const isAnswered = qState.isSubmitted;
      const userSelected = qState.selectedIndex;
      const isCorrect = userSelected === q.correctIndex;

      return `
        <div class="editorial-card p-6 border-r-4 ${isAnswered ? (isCorrect ? 'border-emerald-600' : 'border-red-600') : 'border-stone-300 dark:border-stone-700'}">
          <div class="flex items-center justify-between gap-2 mb-3">
            <span class="text-xs font-bold text-stone-500">${q.lessonTitle} • المستوى: ${q.difficulty}</span>
            <span class="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">
              ${q.type === 'mcq' ? 'اختيار من متعدد' : (q.type === 'tf' ? 'صح أو خطأ' : 'أكمل الفراغ')}
            </span>
          </div>

          <h4 class="text-sm md:text-base font-bold text-stone-900 dark:text-stone-100 mb-4 leading-relaxed">
            ${idx + 1}. ${q.question}
          </h4>

          <!-- خيارات الإجابة التفاعلية (غير محلولة مسبقاً) -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
            ${q.options.map((opt, optIdx) => {
              let optClass = "p-3 rounded-xl text-xs md:text-sm font-medium text-right border transition flex items-center justify-between ";

              if (!isAnswered) {
                if (userSelected === optIdx) {
                  optClass += "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold ring-2 ring-emerald-500";
                } else {
                  optClass += "border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 hover:bg-stone-100 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 cursor-pointer";
                }
              } else {
                if (optIdx === q.correctIndex) {
                  optClass += "border-emerald-600 bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 font-black";
                } else if (optIdx === userSelected) {
                  optClass += "border-red-600 bg-red-100 dark:bg-red-950 text-red-900 dark:text-red-200 font-black";
                } else {
                  optClass += "border-stone-200 dark:border-stone-800 text-stone-400 opacity-60";
                }
              }

              return `
                <button type="button" ${isAnswered ? 'disabled' : ''} onclick="App.selectQbOption('${q.id}', ${optIdx})" class="${optClass}">
                  <span>${opt}</span>
                  ${isAnswered ? (
                    optIdx === q.correctIndex ? `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-600 shrink-0"></i>` :
                    (optIdx === userSelected ? `<i data-lucide="x-circle" class="w-4 h-4 text-red-600 shrink-0"></i>` : '')
                  ) : ''}
                </button>
              `;
            }).join("")}
          </div>

          <!-- شريط الإجراءات: التحقق أو إعادة المحاولة -->
          <div class="flex items-center justify-between pt-2">
            ${!isAnswered ? `
              <div>
                ${userSelected !== null ? `
                  <button type="button" onclick="App.submitQbAnswer('${q.id}')" class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-sm flex items-center gap-1.5 transition">
                    <i data-lucide="check" class="w-4 h-4"></i> تحقق من الإجابة
                  </button>
                ` : `
                  <span class="text-xs text-stone-400">انقر على الخيار المناسب للاختيار</span>
                `}
              </div>
            ` : `
              <div class="flex items-center gap-3 w-full justify-between">
                <span class="text-xs font-bold ${isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}">
                  ${isCorrect ? '✓ أحسنت! إجابة صحيحة' : `✗ إجابة غير صحيحة (الإجابة الصحيحة: ${q.options[q.correctIndex]})`}
                </span>
                <button type="button" onclick="App.retryQbQuestion('${q.id}')" class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-600 dark:text-stone-300 transition">
                  إعادة المحاولة
                </button>
              </div>
            `}
          </div>

          <!-- يظهر التعليل والشرح فقط بعد تأكيد الإجابة -->
          ${isAnswered ? `
            <div class="fade-in mt-4 p-3.5 bg-stone-50 dark:bg-stone-900 rounded-xl text-xs text-stone-700 dark:text-stone-300 border-r-2 border-emerald-600">
              <span class="font-bold text-emerald-800 dark:text-emerald-400">التعليل وتوجيه القاعدة:</span> ${q.explanation}
            </div>
          ` : ''}
        </div>
      `;
    }).join("");
  }

  function selectQbOption(qId, optIdx) {
    try {
      if (!qbState.answers) qbState.answers = {};
      if (qbState.answers[qId] && qbState.answers[qId].isSubmitted) return;
      qbState.answers[qId] = { selectedIndex: optIdx, isSubmitted: false };
      saveQbAnswersToStorage(qbState.answers);
      AudioEffects.playClick();
      const container = document.getElementById("qb-items-container");
      if (container) {
        container.innerHTML = renderQuestionBankItems();
        if (window.lucide) lucide.createIcons();
      }
    } catch (err) {
      console.error("selectQbOption error:", err);
    }
  }

  function submitQbAnswer(qId) {
    try {
      if (!qbState.answers || !qbState.answers[qId]) return;
      const ans = qbState.answers[qId];
      if (ans.selectedIndex === null || ans.selectedIndex === undefined) return;

      ans.isSubmitted = true;
      saveQbAnswersToStorage(qbState.answers);

      const q = QuestionBankData.find(item => item.id === qId);
      if (q) {
        if (ans.selectedIndex === q.correctIndex) {
          AudioEffects.playSuccess();
        } else {
          AudioEffects.playError();
        }
      }

      renderView("question-bank", {}, false);
    } catch (err) {
      console.error("submitQbAnswer error:", err);
    }
  }

  function retryQbQuestion(qId) {
    try {
      if (qbState.answers && qbState.answers[qId]) {
        delete qbState.answers[qId];
        saveQbAnswersToStorage(qbState.answers);
      }
      AudioEffects.playClick();
      renderView("question-bank", {}, false);
    } catch (err) {
      console.error("retryQbQuestion error:", err);
    }
  }

  function resetQbAnswers() {
    try {
      if (confirm("هل تريد إعادة ضبط جميع إجابات بنك الأسئلة للبدء من جديد؟")) {
        qbState.answers = {};
        clearQbAnswersFromStorage();
        AudioEffects.playClick();
        renderView("question-bank", {}, false);
      }
    } catch (err) {
      console.error("resetQbAnswers error:", err);
      qbState.answers = {};
      clearQbAnswersFromStorage();
      renderView("question-bank", {}, false);
    }
  }

  // ==========================================
  // مُولّد الاختبارات العشوائية (Random Quiz)
  // ==========================================
  function renderRandomQuizView() {
    const lessonsList = [
      ...CurriculumData.reading.map(l => ({ id: l.id, title: l.title, cat: "قراءة" })),
      ...CurriculumData.texts.map(l => ({ id: l.id, title: l.title, cat: "نصوص" })),
      ...CurriculumData.curriculumGrammar.map(l => ({ id: l.id, title: l.title, cat: "نحو" })),
      ...CurriculumData.spelling.map(l => ({ id: l.id, title: l.title, cat: "كتابة" }))
    ];

    return `
      <div class="max-w-3xl mx-auto editorial-card p-6 md:p-10">
        <div class="text-center max-w-xl mx-auto mb-8">
          <div class="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center mx-auto mb-3">
            <i data-lucide="shuffle" class="w-6 h-6"></i>
          </div>
          <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100">مولد الاختبار العشوائي الذكي</h2>
          <p class="text-xs text-stone-500 mt-1">خصص تدريبك بحرية كاملة؛ اختر موضوعات المنهج وعدد الأسئلة ونوعيتها وتدرّب فوراً.</p>
        </div>

        <form id="random-quiz-form" onsubmit="App.handleGenerateRandomQuiz(event)" class="space-y-6">
          <div>
            <label class="block text-xs font-extrabold text-stone-700 dark:text-stone-300 mb-2">
              ١. اختر الدروس والموضوعات المطلوبة:
            </label>
            <div class="flex items-center gap-2 mb-2">
              <button type="button" onclick="App.toggleAllLessons(true)" class="text-xs text-emerald-700 dark:text-emerald-400 font-bold hover:underline">تحديد الكل</button>
              <span class="text-stone-300">•</span>
              <button type="button" onclick="App.toggleAllLessons(false)" class="text-xs text-stone-500 hover:underline">إلغاء التحديد</button>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-3 bg-stone-50 dark:bg-stone-900/60 rounded-xl border border-stone-200 dark:border-stone-800">
              ${lessonsList.map(l => `
                <label class="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded cursor-pointer">
                  <input type="checkbox" name="quiz_lessons" value="${l.id}" checked class="rounded text-emerald-600 focus:ring-emerald-500">
                  <span class="font-bold text-stone-500 text-[10px]">[${l.cat}]</span>
                  <span>${l.title}</span>
                </label>
              `).join("")}
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-xs font-extrabold text-stone-700 dark:text-stone-300 mb-2">
                ٢. عدد الأسئلة:
              </label>
              <select name="question_count" class="w-full text-xs font-bold p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl">
                <option value="5">٥ أسئلة (تدريب سريع)</option>
                <option value="10" selected>١٠ أسئلة (تدريب قياسي)</option>
                <option value="15">١٥ سؤالاً (تدريب متعمق)</option>
                <option value="20">٢٠ سؤالاً (مراجعة شاملة)</option>
                <option value="30">٣٠ سؤالاً (تحدي المنهج كاملاً)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-extrabold text-stone-700 dark:text-stone-300 mb-2">
                ٣. أنواع الأسئلة:
              </label>
              <select name="question_type" class="w-full text-xs font-bold p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-xl">
                <option value="all" selected>جميع الأنواع (اختيار + صح وخطأ + أكمل)</option>
                <option value="mcq">اختيار من متعدد فقط</option>
                <option value="tf">صح أو خطأ فقط</option>
                <option value="complete">أكمل الجملة فقط</option>
              </select>
            </div>
          </div>

          <button type="submit" class="w-full py-3.5 rounded-xl text-sm font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow-lg flex items-center justify-center gap-2 transition">
            <i data-lucide="play" class="w-4 h-4"></i> توليد وبدء الاختبار الآن
          </button>
        </form>
      </div>
    `;
  }

  function toggleAllLessons(select) {
    document.querySelectorAll("input[name='quiz_lessons']").forEach(cb => {
      cb.checked = select;
    });
  }

  function handleGenerateRandomQuiz(e) {
    e.preventDefault();
    const form = e.target;
    const checkedLessons = Array.from(form.querySelectorAll("input[name='quiz_lessons']:checked")).map(cb => cb.value);
    if (checkedLessons.length === 0) {
      alert("يرجى اختيار درس واحد على الأقل للتدريب عليه.");
      return;
    }

    const count = parseInt(form.question_count.value, 10);
    const typeFilter = form.question_type.value;

    let pool = QuestionBankData.filter(q => checkedLessons.includes(q.lessonId));
    if (typeFilter !== "all") {
      pool = pool.filter(q => q.type === typeFilter);
    }

    if (pool.length === 0) {
      alert("لم يتم العثور على أسئلة مطابقة للخيارات المحددة.");
      return;
    }

    const shuffled = [...pool].sort(() => 0.5 - Math.random()).slice(0, count);

    activeQuizState = {
      isPlacement: false,
      title: `اختبار عشوائي (${shuffled.length} سؤالاً)`,
      questions: shuffled,
      currentIndex: 0,
      userAnswers: new Array(shuffled.length).fill(null),
      isFinished: false
    };

    const container = document.getElementById("app-content");
    container.innerHTML = `<div class="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">${renderActiveQuizPresenter()}</div>`;
    if (window.lucide) lucide.createIcons();
  }

  function startLessonQuiz(lessonId) {
    const questions = QuestionBankData.filter(q => q.lessonId === lessonId);
    if (!questions || questions.length === 0) {
      alert("جاري تجهيز أسئلة إضافية لهذا الدرس.");
      return;
    }
    const shuffled = [...questions].sort(() => 0.5 - Math.random());

    activeQuizState = {
      isPlacement: false,
      lessonId: lessonId,
      title: `اختبار تقييمي: ${questions[0].lessonTitle}`,
      questions: shuffled,
      currentIndex: 0,
      userAnswers: new Array(shuffled.length).fill(null),
      isFinished: false
    };

    const container = document.getElementById("app-content");
    container.innerHTML = `<div class="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">${renderActiveQuizPresenter()}</div>`;
    if (window.lucide) lucide.createIcons();
  }

  // ==========================================
  // عارض الأسئلة التفاعلي الموحد (Quiz Presenter)
  // ==========================================
  function renderActiveQuizPresenter() {
    if (!activeQuizState) return `<p class="p-8 text-center text-red-600">لا يوجد اختبار نشط.</p>`;

    const { questions, currentIndex, userAnswers, isFinished, title } = activeQuizState;

    if (isFinished) {
      return renderQuizResultScreen();
    }

    const currentQ = questions[currentIndex];
    const userAnswer = userAnswers[currentIndex];
    const isAnswered = userAnswer !== null;
    const progressPercent = Math.round(((currentIndex + 1) / questions.length) * 100);

    return `
      <div class="max-w-3xl mx-auto">
        <div class="editorial-card p-5 mb-6">
          <div class="flex items-center justify-between text-xs font-bold text-stone-500 mb-2">
            <span>${title}</span>
            <span>السؤال ${currentIndex + 1} من ${questions.length}</span>
          </div>
          <div class="w-full h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
            <div class="h-full bg-emerald-600 rounded-full transition-all duration-300" style="width: ${progressPercent}%"></div>
          </div>
        </div>

        <div class="editorial-card p-6 md:p-8 mb-6">
          <div class="flex items-center justify-between gap-2 mb-4">
            <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
              ${currentQ.difficulty ? `المستوى: ${currentQ.difficulty}` : (currentQ.lessonTitle || 'سؤال منهجي')}
            </span>
            <span class="text-xs text-stone-400">
              ${currentQ.type === 'mcq' ? 'اختيار من متعدد' : (currentQ.type === 'tf' ? 'صح أو خطأ' : 'أكمل الجملة')}
            </span>
          </div>

          <h3 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 mb-6 leading-relaxed">
            ${currentQ.question}
          </h3>

          <div class="space-y-3 mb-6">
            ${currentQ.options.map((opt, optIndex) => {
              let btnClass = "w-full p-4 text-right rounded-xl font-medium text-xs md:text-sm border transition flex items-center justify-between ";
              
              if (!isAnswered) {
                btnClass += "bg-stone-50 hover:bg-stone-100 dark:bg-stone-800 dark:hover:bg-stone-700 border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200";
              } else {
                if (optIndex === currentQ.correctIndex) {
                  btnClass += "bg-emerald-100 dark:bg-emerald-950 border-emerald-500 text-emerald-900 dark:text-emerald-200 font-bold";
                } else if (optIndex === userAnswer) {
                  btnClass += "bg-red-100 dark:bg-red-950 border-red-500 text-red-900 dark:text-red-200 font-bold";
                } else {
                  btnClass += "bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-800 text-stone-400 opacity-60";
                }
              }

              return `
                <button type="button" ${isAnswered ? 'disabled' : ''} onclick="App.handleQuizAnswerSelect(${optIndex})" class="${btnClass}">
                  <span>${opt}</span>
                  ${isAnswered ? (
                    optIndex === currentQ.correctIndex 
                      ? `<i data-lucide="check-circle" class="w-5 h-5 text-emerald-600 shrink-0"></i>` 
                      : (optIndex === userAnswer ? `<i data-lucide="x-circle" class="w-5 h-5 text-red-600 shrink-0"></i>` : '')
                  ) : ''}
                </button>
              `;
            }).join("")}
          </div>

          ${isAnswered ? `
            <div class="fade-in p-4 rounded-xl ${userAnswer === currentQ.correctIndex ? 'bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800'} mb-6">
              <div class="flex items-center gap-2 font-bold text-xs md:text-sm ${userAnswer === currentQ.correctIndex ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'} mb-1.5">
                <i data-lucide="${userAnswer === currentQ.correctIndex ? 'check-circle' : 'alert-circle'}" class="w-4 h-4"></i>
                <span>${userAnswer === currentQ.correctIndex ? 'إجابة ممتازة وصحيحة!' : 'إجابة غير صحيحة، طالع الشرح والتوجيه:'}</span>
              </div>
              <p class="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                <span class="font-bold">الشرح والتعليل:</span> ${currentQ.explanation}
              </p>
            </div>
          ` : ''}

          <div class="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-800">
            <button ${currentIndex === 0 ? 'disabled' : ''} onclick="App.navigateQuizQuestion(-1)" class="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 disabled:opacity-40">
              السابق
            </button>

            ${isAnswered ? `
              <button onclick="App.navigateQuizQuestion(1)" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow flex items-center gap-1.5">
                <span>${currentIndex + 1 === questions.length ? 'إنهاء وعرض النتيجة' : 'السؤال التالي'}</span>
                <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
              </button>
            ` : `
              <span class="text-xs text-stone-400">اختر إجابة للمتابعة</span>
            `}
          </div>
        </div>
      </div>
    `;
  }

  function handleQuizAnswerSelect(selectedIndex) {
    if (!activeQuizState) return;
    const { questions, currentIndex, userAnswers } = activeQuizState;
    if (userAnswers[currentIndex] !== null) return;

    userAnswers[currentIndex] = selectedIndex;
    const isCorrect = selectedIndex === questions[currentIndex].correctIndex;

    if (isCorrect) {
      AudioEffects.playSuccess();
    } else {
      AudioEffects.playError();
    }

    const container = document.getElementById("app-content");
    container.innerHTML = `<div class="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">${renderActiveQuizPresenter()}</div>`;
    if (window.lucide) lucide.createIcons();
  }

  function navigateQuizQuestion(direction) {
    if (!activeQuizState) return;
    const newIndex = activeQuizState.currentIndex + direction;

    if (newIndex >= activeQuizState.questions.length) {
      activeQuizState.isFinished = true;
    } else if (newIndex >= 0) {
      activeQuizState.currentIndex = newIndex;
    }

    const container = document.getElementById("app-content");
    container.innerHTML = `<div class="fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">${renderActiveQuizPresenter()}</div>`;
    if (window.lucide) lucide.createIcons();
  }

  function renderQuizResultScreen() {
    const { questions, userAnswers, isPlacement, title, lessonId } = activeQuizState;
    
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctIndex) correctCount++;
    });

    const percentage = Math.round((correctCount / questions.length) * 100);

    let placementInfo = null;
    if (isPlacement) {
      placementInfo = PreviousGrammarData.placementTest.evaluateLevel(correctCount);
      StorageManager.savePlacementResult({
        score: correctCount,
        total: questions.length,
        level: placementInfo.level,
        badge: placementInfo.badge
      });
    } else {
      StorageManager.recordQuizResult({
        title: title,
        score: correctCount,
        total: questions.length,
        percentage: percentage,
        lessonId: lessonId || null
      });
    }

    return `
      <div class="max-w-2xl mx-auto editorial-card p-6 md:p-10 text-center">
        <div class="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${percentage >= 60 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}">
          <i data-lucide="${percentage >= 60 ? 'award' : 'refresh-ccw'}" class="w-8 h-8"></i>
        </div>

        <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100 mb-1">
          ${isPlacement ? 'تقرير تحديد المستوى النحوي' : 'نتيجة الاختبار'}
        </h2>
        <p class="text-xs text-stone-500 mb-6">${title}</p>

        <div class="p-6 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 mb-6 inline-block w-full">
          <div class="text-4xl font-black text-emerald-700 dark:text-emerald-400 mb-1">${percentage}%</div>
          <span class="text-xs font-bold text-stone-500 block">أجبت على ${correctCount} من إجمالي ${questions.length} سؤالاً بشكل صحيح</span>
        </div>

        ${isPlacement && placementInfo ? `
          <div class="p-5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 text-right mb-6 space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-extrabold text-sm text-purple-900 dark:text-purple-300">تصنيف مستواك: ${placementInfo.level}</span>
              <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-200 dark:bg-purple-900 text-purple-900 dark:text-purple-200">
                وسام: ${placementInfo.badge}
              </span>
            </div>
            <p class="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
              <span class="font-bold">توصية المسار:</span> ${placementInfo.advice}
            </p>
          </div>
        ` : ''}

        <div class="flex flex-wrap justify-center gap-3">
          <button onclick="App.renderView('home')" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900">
            العودة للرئيسية
          </button>
          ${isPlacement ? `
            <button onclick="App.renderView('previous-grammar')" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-purple-800 text-white">
              الانتقال لمحطات التأسيس
            </button>
          ` : `
            <button onclick="App.renderView('random-quiz')" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-800 text-white">
              اختبار جديد
            </button>
          `}
        </div>
      </div>
    `;
  }

  function renderPlacementTestView() {
    const test = PreviousGrammarData.placementTest;
    
    activeQuizState = {
      isPlacement: true,
      title: test.title,
      questions: test.questions,
      currentIndex: 0,
      userAnswers: new Array(test.questions.length).fill(null),
      isFinished: false
    };

    return renderActiveQuizPresenter();
  }

  // ==========================================
  // قسم الامتحانات الرسمية (Exams System)
  // ==========================================
  function renderExamsView() {
    const exams = ExamsData;

    let examsHtml = exams.map(exam => `
      <div class="editorial-card p-6 flex flex-col justify-between hover:border-emerald-700 transition">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              ${exam.category}
            </span>
            <span class="text-xs text-stone-500 font-semibold flex items-center gap-1">
              <i data-lucide="clock" class="w-3.5 h-3.5"></i> ${exam.durationMinutes} دقيقة
            </span>
          </div>

          <h3 class="text-xl font-bold text-stone-900 dark:text-stone-100 mb-2">${exam.title}</h3>
          <p class="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-4">
            ${exam.description}
          </p>

          <div class="flex items-center gap-4 text-xs font-bold text-stone-500 mb-4">
            <span>عدد الأسئلة: ${exam.questionIds.length} سؤالاً</span>
            <span>درجة النجاح: ${exam.passScore}%</span>
          </div>
        </div>

        <div class="pt-4 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center">
          <button onclick="App.startOfficialExam('${exam.id}')" class="w-full py-2.5 rounded-xl text-xs font-bold bg-emerald-800 hover:bg-emerald-900 text-white shadow flex items-center justify-center gap-2 transition">
            <i data-lucide="play" class="w-4 h-4"></i> بدء الامتحان الآن
          </button>
        </div>
      </div>
    `).join("");

    return `
      <div class="mb-8">
        <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100">نماذج الامتحانات والاختبارات الشاملة</h2>
        <p class="text-xs text-stone-500 mt-1">امتحانات زمنية منضبطة تحاكي المعايير الرسمية لوزارة التربية والتعليم للتعليم الفني.</p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${examsHtml}
      </div>
    `;
  }

  function startOfficialExam(examId) {
    const exam = ExamsData.find(e => e.id === examId);
    if (!exam) return;

    const questions = exam.questionIds.map(qid => QuestionBankData.find(q => q.id === qid)).filter(Boolean);

    activeExamState = {
      exam: exam,
      questions: questions,
      currentIndex: 0,
      userAnswers: new Array(questions.length).fill(null),
      remainingSeconds: exam.durationMinutes * 60,
      isSubmitted: false
    };

    examTimerInterval = setInterval(() => {
      if (!activeExamState || activeExamState.isSubmitted) {
        clearInterval(examTimerInterval);
        return;
      }
      activeExamState.remainingSeconds--;
      updateExamTimerDisplay();

      if (activeExamState.remainingSeconds <= 0) {
        clearInterval(examTimerInterval);
        submitActiveExam(true);
      }
    }, 1000);

    renderView("active-exam", { examId: examId });
  }

  function updateExamTimerDisplay() {
    const el = document.getElementById("exam-timer-display");
    if (!el || !activeExamState) return;
    const mins = Math.floor(activeExamState.remainingSeconds / 60);
    const secs = activeExamState.remainingSeconds % 60;
    el.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    if (activeExamState.remainingSeconds < 300) {
      el.classList.add("text-red-600", "animate-pulse");
    }
  }

  function renderActiveExamView() {
    if (!activeExamState) return `<p class="p-8 text-center text-red-600">لا يوجد امتحان نشط.</p>`;

    const { exam, questions, currentIndex, userAnswers } = activeExamState;
    const currentQ = questions[currentIndex];
    const mins = Math.floor(activeExamState.remainingSeconds / 60);
    const secs = activeExamState.remainingSeconds % 60;

    return `
      <div class="max-w-4xl mx-auto">
        <div class="editorial-card p-4 md:p-6 mb-6 flex flex-wrap items-center justify-between gap-4 sticky top-16 z-30 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md">
          <div>
            <h2 class="text-base md:text-lg font-black text-stone-900 dark:text-stone-100">${exam.title}</h2>
            <span class="text-xs text-stone-500">السؤال رقم ${currentIndex + 1} من ${questions.length}</span>
          </div>

          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2 font-mono text-base md:text-lg font-bold bg-stone-100 dark:bg-stone-800 px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700">
              <i data-lucide="clock" class="w-4 h-4 text-emerald-600"></i>
              <span id="exam-timer-display">${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}</span>
            </div>

            <button onclick="App.confirmSubmitExam()" class="px-4 py-2 rounded-xl text-xs font-bold bg-red-700 hover:bg-red-800 text-white shadow transition">
              تسليم الامتحان
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div class="editorial-card p-4 h-fit order-2 lg:order-1">
            <h3 class="text-xs font-bold text-stone-500 mb-3">خريطة الأسئلة:</h3>
            <div class="grid grid-cols-5 gap-2">
              ${questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const isAnswered = userAnswers[idx] !== null;
                let bg = "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400";
                if (isCurrent) {
                  bg = "bg-emerald-700 text-white font-bold ring-2 ring-emerald-500";
                } else if (isAnswered) {
                  bg = "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 font-bold";
                }

                return `
                  <button type="button" onclick="App.jumpToExamQuestion(${idx})" class="w-full aspect-square rounded-lg text-xs flex items-center justify-center transition ${bg}">
                    ${idx + 1}
                  </button>
                `;
              }).join("")}
            </div>
          </div>

          <div class="editorial-card p-6 md:p-8 lg:col-span-3 order-1 lg:order-2">
            <div class="flex items-center justify-between text-xs text-stone-400 mb-3">
              <span>${currentQ.lessonTitle}</span>
              <span>درجة السؤال: درجة واحدة</span>
            </div>

            <h3 class="text-lg md:text-xl font-bold text-stone-900 dark:text-stone-100 mb-6 leading-relaxed">
              ${currentIndex + 1}. ${currentQ.question}
            </h3>

            <div class="space-y-3 mb-8">
              ${currentQ.options.map((opt, optIndex) => {
                const isSelected = userAnswers[currentIndex] === optIndex;
                return `
                  <label class="p-4 rounded-xl border flex items-center justify-between cursor-pointer transition ${isSelected ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-900 dark:text-emerald-200 font-bold' : 'bg-stone-50 dark:bg-stone-800/40 border-stone-200 dark:border-stone-700 text-stone-800 dark:text-stone-200 hover:bg-stone-100'}">
                    <div class="flex items-center gap-3">
                      <input type="radio" name="exam_choice" value="${optIndex}" ${isSelected ? 'checked' : ''} onchange="App.handleExamAnswerSelect(${optIndex})" class="text-emerald-700 focus:ring-emerald-500">
                      <span class="text-xs md:text-sm">${opt}</span>
                    </div>
                  </label>
                `;
              }).join("")}
            </div>

            <div class="flex items-center justify-between pt-4 border-t border-stone-100 dark:border-stone-800">
              <button ${currentIndex === 0 ? 'disabled' : ''} onclick="App.jumpToExamQuestion(${currentIndex - 1})" class="px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-stone-800 disabled:opacity-40">
                السؤال السابق
              </button>

              ${currentIndex + 1 < questions.length ? `
                <button onclick="App.jumpToExamQuestion(${currentIndex + 1})" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 flex items-center gap-1.5">
                  السؤال التالي <i data-lucide="arrow-left" class="w-3.5 h-3.5"></i>
                </button>
              ` : `
                <button onclick="App.confirmSubmitExam()" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-800 text-white shadow">
                  مراجعة وتسليم الامتحان
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function handleExamAnswerSelect(optIndex) {
    if (!activeExamState) return;
    activeExamState.userAnswers[activeExamState.currentIndex] = optIndex;
    AudioEffects.playClick();
    renderView("active-exam", { examId: activeExamState.exam.id }, false);
  }

  function jumpToExamQuestion(index) {
    if (!activeExamState) return;
    if (index >= 0 && index < activeExamState.questions.length) {
      activeExamState.currentIndex = index;
      renderView("active-exam", { examId: activeExamState.exam.id }, false);
    }
  }

  function confirmSubmitExam() {
    if (!activeExamState) return;
    const unanswered = activeExamState.userAnswers.filter(a => a === null).length;
    let msg = "هل أنت متأكد من تسليم ورقة الامتحان الآن؟";
    if (unanswered > 0) {
      msg = `تنبيه: لديك ${unanswered} سؤالاً لم تقم بالإجابة عليها بعد. هل ترغب في التسليم الفعلي؟`;
    }
    if (confirm(msg)) {
      submitActiveExam(false);
    }
  }

  function submitActiveExam(isTimeOut = false) {
    if (!activeExamState) return;
    if (examTimerInterval) {
      clearInterval(examTimerInterval);
      examTimerInterval = null;
    }

    activeExamState.isSubmitted = true;
    const { exam, questions, userAnswers } = activeExamState;

    let score = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctIndex) score++;
    });

    const percentage = Math.round((score / questions.length) * 100);
    const passed = percentage >= exam.passScore;

    StorageManager.recordExamResult({
      examId: exam.id,
      title: exam.title,
      score: score,
      total: questions.length,
      percentage: percentage,
      passed: passed,
      timeSpentMinutes: exam.durationMinutes - Math.ceil(activeExamState.remainingSeconds / 60)
    });

    if (passed) {
      AudioEffects.playSuccess();
    } else {
      AudioEffects.playError();
    }

    renderExamDetailedResults(score, percentage, passed, isTimeOut);
  }

  function renderExamDetailedResults(score, percentage, passed, isTimeOut) {
    const { exam, questions, userAnswers } = activeExamState;

    const container = document.getElementById("app-content");
    container.innerHTML = `
      <div class="max-w-3xl mx-auto py-6">
        <div class="editorial-card p-6 md:p-10 text-center mb-8">
          <div class="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${passed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'}">
            <i data-lucide="${passed ? 'award' : 'alert-octagon'}" class="w-8 h-8"></i>
          </div>

          <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100 mb-1">
            ${passed ? 'مبارك! اجتزت الامتحان بنجاح' : 'لم توفق في اجتياز الامتحان هذه المرة'}
          </h2>
          <p class="text-xs text-stone-500 mb-6">${exam.title} ${isTimeOut ? '(انتهى الوقت المخصص)' : ''}</p>

          <div class="p-6 bg-stone-50 dark:bg-stone-900/60 rounded-2xl border border-stone-200 dark:border-stone-800 mb-6 inline-block w-full max-w-sm">
            <div class="text-4xl font-black ${passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'} mb-1">${percentage}%</div>
            <span class="text-xs font-bold text-stone-500 block">الدرجة: ${score} من ${questions.length} (الحد الأدنى: ${exam.passScore}%)</span>
          </div>

          <div class="flex justify-center gap-3">
            <button onclick="App.renderView('exams')" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900">
              قائمة الامتحانات
            </button>
            <button onclick="App.renderView('progress')" class="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-800 text-white">
              لوحة الإنجازات
            </button>
          </div>
        </div>

        <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
          <i data-lucide="list-checks" class="w-5 h-5 text-emerald-700"></i> المراجعة التفصيلية لورقة الإجابة:
        </h3>

        <div class="space-y-4">
          ${questions.map((q, idx) => {
            const userAns = userAnswers[idx];
            const isCorrect = userAns === q.correctIndex;
            return `
              <div class="editorial-card p-5 border-r-4 ${isCorrect ? 'border-emerald-600' : 'border-red-600'}">
                <div class="flex items-center justify-between text-xs mb-2">
                  <span class="font-bold text-stone-500">سؤال ${idx + 1} (${q.lessonTitle})</span>
                  <span class="font-bold ${isCorrect ? 'text-emerald-700' : 'text-red-600'}">
                    ${isCorrect ? '✓ إجابة صحيحة' : (userAns === null ? 'لم تتم الإجابة' : '✗ إجابة خاطئة')}
                  </span>
                </div>
                <h4 class="text-sm font-bold text-stone-900 dark:text-stone-100 mb-3">${q.question}</h4>
                <div class="space-y-1.5 text-xs mb-3">
                  <div class="text-emerald-800 dark:text-emerald-400 font-bold">
                    الإجابة النموذجية: ${q.options[q.correctIndex]}
                  </div>
                  ${!isCorrect && userAns !== null ? `
                    <div class="text-red-700 dark:text-red-400">
                      إجابتك: ${q.options[userAns]}
                    </div>
                  ` : ''}
                </div>
                <div class="p-3 bg-stone-50 dark:bg-stone-900 rounded-lg text-xs text-stone-600 dark:text-stone-300">
                  <span class="font-bold text-emerald-700">التعليل:</span> ${q.explanation}
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  }

  // ==========================================
  // معجم المفردات واللغويات (Vocabulary View)
  // ==========================================
  function renderVocabularyView() {
    let allVocab = [];
    CurriculumData.reading.forEach(l => {
      (l.vocabulary || []).forEach(v => allVocab.push({ ...v, lesson: l.title, cat: "قراءة" }));
    });
    CurriculumData.texts.forEach(l => {
      (l.vocabulary || []).forEach(v => allVocab.push({ ...v, lesson: l.title, cat: "نصوص" }));
    });

    return `
      <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100">معجم لغويات المنهج المعتمد</h2>
          <p class="text-xs text-stone-500 mt-1">المعجم اللغوي الكامل لجميع مفردات القراءة والنصوص المقررة (${allVocab.length} مفردة).</p>
        </div>

        <div class="w-full sm:w-72">
          <input type="text" id="vocab-search-input" oninput="App.handleVocabSearch(event)" placeholder="ابحث بالكلمة أو معناها..." class="w-full text-xs p-3 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl">
        </div>
      </div>

      <div id="vocab-table-container" class="editorial-card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-xs md:text-sm text-right border-collapse">
            <thead>
              <tr class="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                <th class="p-3 font-extrabold">الكلمة والتعبير</th>
                <th class="p-3 font-extrabold">المعنى والشرح والمضاد</th>
                <th class="p-3 font-extrabold">الدرس التابع له</th>
              </tr>
            </thead>
            <tbody id="vocab-tbody" class="divide-y divide-stone-100 dark:divide-stone-800">
              ${renderVocabRows(allVocab)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function handleVocabSearch(e) {
    const term = e.target.value.trim().toLowerCase();
    let allVocab = [];
    CurriculumData.reading.forEach(l => {
      (l.vocabulary || []).forEach(v => allVocab.push({ ...v, lesson: l.title, cat: "قراءة" }));
    });
    CurriculumData.texts.forEach(l => {
      (l.vocabulary || []).forEach(v => allVocab.push({ ...v, lesson: l.title, cat: "نصوص" }));
    });

    const filtered = allVocab.filter(v => 
      v.word.toLowerCase().includes(term) || v.meaning.toLowerCase().includes(term) || v.lesson.toLowerCase().includes(term)
    );

    const tbody = document.getElementById("vocab-tbody");
    if (tbody) {
      tbody.innerHTML = renderVocabRows(filtered);
    }
  }

  function renderVocabRows(items) {
    if (items.length === 0) {
      return `<tr><td colspan="3" class="p-8 text-center text-stone-400">لا توجد مفردات مطابقة للبحث.</td></tr>`;
    }
    return items.map(v => `
      <tr class="hover:bg-stone-50 dark:hover:bg-stone-800/40">
        <td class="p-3 font-bold text-emerald-800 dark:text-emerald-400 whitespace-nowrap">${v.word}</td>
        <td class="p-3 text-stone-700 dark:text-stone-300 leading-relaxed">${v.meaning}</td>
        <td class="p-3 text-stone-500 whitespace-nowrap text-xs"><span class="px-2 py-0.5 rounded bg-stone-100 dark:bg-stone-800">${v.lesson}</span></td>
      </tr>
    `).join("");
  }

  // ==========================================
  // لوحة تقدم الطالب والأوسمة (Progress View)
  // ==========================================
  function renderProgressView() {
    const stats = StorageManager.getOverallStats();
    const badges = StorageManager.getAllBadges();
    const state = StorageManager.getState();

    return `
      <div class="mb-8">
        <h2 class="text-2xl font-black text-stone-900 dark:text-stone-100">لوحة تقدم الطالب وسجل الإنجازات</h2>
        <p class="text-xs text-stone-500 mt-1">تتبع مسارك التعليمي، إحصائيات دقة الحلول، وشارات التفوق المحققة.</p>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="editorial-card p-5 text-center">
          <span class="text-xs text-stone-500 block mb-1">منهج القراءة والنصوص</span>
          <span class="text-2xl font-black text-emerald-700 dark:text-emerald-400">${stats.curriculumPercentage}%</span>
          <span class="text-[10px] text-stone-400 block mt-1">${stats.completedCount} من ${stats.totalCurriculumLessons} دروس</span>
        </div>

        <div class="editorial-card p-5 text-center">
          <span class="text-xs text-stone-500 block mb-1">التأسيس النحوي</span>
          <span class="text-2xl font-black text-purple-700 dark:text-purple-400">${stats.grammarPercentage}%</span>
          <span class="text-[10px] text-stone-400 block mt-1">${stats.completedGrammar} من 12 مرحلة</span>
        </div>

        <div class="editorial-card p-5 text-center">
          <span class="text-xs text-stone-500 block mb-1">نقاط الخبرة (XP)</span>
          <span class="text-2xl font-black text-amber-700 dark:text-amber-400">${stats.xp}</span>
          <span class="text-[10px] text-stone-400 block mt-1">رتبة: متفوق</span>
        </div>

        <div class="editorial-card p-5 text-center">
          <span class="text-xs text-stone-500 block mb-1">دقة الإجابات العامة</span>
          <span class="text-2xl font-black text-blue-700 dark:text-blue-400">${stats.overallAccuracy}%</span>
          <span class="text-[10px] text-stone-400 block mt-1">${stats.totalCorrect} إجابة صحيحة</span>
        </div>
      </div>

      <div class="editorial-card p-6 md:p-8 mb-8">
        <h3 class="text-lg font-bold text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
          <i data-lucide="award" class="w-5 h-5 text-amber-600"></i> شارات وأوسمة الإنجاز
        </h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          ${badges.map(b => `
            <div class="p-4 rounded-xl text-center border transition ${b.isUnlocked ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 shadow-sm badge-glow' : 'bg-stone-50 dark:bg-stone-900/40 border-stone-200 dark:border-stone-800 opacity-50 grayscale'}">
              <div class="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center ${b.isUnlocked ? 'bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200' : 'bg-stone-200 dark:bg-stone-800 text-stone-400'}">
                <i data-lucide="${b.icon}" class="w-5 h-5"></i>
              </div>
              <h4 class="font-bold text-xs text-stone-900 dark:text-stone-100 mb-1">${b.title}</h4>
              <p class="text-[10px] text-stone-500 leading-tight">${b.description}</p>
            </div>
          `).join("")}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div class="editorial-card p-6">
          <h3 class="font-bold text-sm text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
            <i data-lucide="zap" class="w-4 h-4 text-emerald-600"></i> سجل الاختبارات القصيرة
          </h3>
          ${(state.quizHistory && state.quizHistory.length > 0) ? `
            <div class="space-y-2 max-h-60 overflow-y-auto">
              ${state.quizHistory.map(q => `
                <div class="p-3 bg-stone-50 dark:bg-stone-900 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span class="font-bold text-stone-800 dark:text-stone-200 block">${q.title}</span>
                    <span class="text-[10px] text-stone-400">${q.date}</span>
                  </div>
                  <span class="font-extrabold text-sm ${q.percentage >= 60 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600'}">
                    ${q.score}/${q.total} (${q.percentage}%)
                  </span>
                </div>
              `).join("")}
            </div>
          ` : `
            <p class="text-xs text-stone-400 text-center py-6">لم تقم بإجراء اختبارات قصيرة بعد.</p>
          `}
        </div>

        <div class="editorial-card p-6">
          <h3 class="font-bold text-sm text-stone-900 dark:text-stone-100 mb-4 flex items-center gap-2">
            <i data-lucide="file-check-2" class="w-4 h-4 text-blue-600"></i> سجل الامتحانات الشاملة
          </h3>
          ${(state.examHistory && state.examHistory.length > 0) ? `
            <div class="space-y-2 max-h-60 overflow-y-auto">
              ${state.examHistory.map(e => `
                <div class="p-3 bg-stone-50 dark:bg-stone-900 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span class="font-bold text-stone-800 dark:text-stone-200 block">${e.title}</span>
                    <span class="text-[10px] text-stone-400">${e.date} • الوقت: ${e.timeSpentMinutes} د</span>
                  </div>
                  <span class="font-extrabold text-sm ${e.passed ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600'}">
                    ${e.score}/${e.total} (${e.percentage}%)
                  </span>
                </div>
              `).join("")}
            </div>
          ` : `
            <p class="text-xs text-stone-400 text-center py-6">لم تؤدِ أي امتحان رسمي بعد.</p>
          `}
        </div>
      </div>

      <div class="editorial-card p-5 flex items-center justify-between">
        <div>
          <h4 class="text-xs font-bold text-stone-800 dark:text-stone-200">إدارة الذاكرة المحلية</h4>
          <p class="text-[11px] text-stone-500">حفظ البيانات مستمر على متصفحك تلقائياً وبشكل دائم.</p>
        </div>
        <button onclick="App.handleResetData()" class="px-3.5 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition">
          إعادة ضبط السجل
        </button>
      </div>
    `;
  }

  function handleResetData() {
    if (confirm("هل أنت متأكد من رغبتك في إعادة ضبط وحذف كافة السجلات ودرجات الاختبارات؟ لا يمكن التراجع عن هذا الإجراء.")) {
      StorageManager.resetAllData();
      AudioEffects.playError();
      renderView("progress", {}, false);
    }
  }

  function updateNavBadge() {
    // تحديث أي شارات مستقبلية إن لزم
  }

  function attachViewEvents(viewName, params) {
    // ربط الأحداث الخاصة بالصفحة النشطة
  }

  // الواجهة العامة المعرضة للنافذة
  return {
    init,
    renderView,
    toggleTheme,
    markActiveLessonCompleted,
    openGrammarModal,
    closeGrammarModal,
    toggleGrammarStageDone,
    handleGenerateRandomQuiz,
    toggleAllLessons,
    startLessonQuiz,
    handleQuizAnswerSelect,
    navigateQuizQuestion,
    handleQbFilterChange,
    selectQbOption,
    submitQbAnswer,
    retryQbQuestion,
    resetQbAnswers,
    startOfficialExam,
    jumpToExamQuestion,
    handleExamAnswerSelect,
    confirmSubmitExam,
    handleVocabSearch,
    handleResetData,
    dismissMenuTooltip
  };
})();

// بدء التطبيق فور جهوزية الـ DOM
document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
