/* vdole.ai prototype — lightweight in-page visual editor.
   Included on landing.html / promoters.html / brands.html.
   Toggle with the floating pencil button (bottom-right).
   Edits (text, basic style, drag order) persist per-page in localStorage. */
(function () {
  "use strict";
  if (window.__vdEditor) return;
  window.__vdEditor = true;

  var PAGE = (location.pathname.split("/").pop() || "index.html").replace(/\.html$/, "") || "index";
  var STORE_KEY = "vdole_editor_" + PAGE;
  var UNDO_KEY = STORE_KEY + "_undo";
  var UNDO_MAX = 20;

  var SELECTABLE =
    "h1,h2,h3,p,span,button,.btn,li,label,td,a,.thesis-card,.pain-card,.chip,.checklist-row," +
    ".tl-step,.tl-row,.faq-item,.door,.money-panel,.text-panel,.signup-panel," +
    ".door-counter,.door-eyebrow,.kicker,.brand-mark,.hero-spectro";
  var DRAGGABLE = ".thesis-card,.pain-card,.chip,.checklist-row,.tl-step,.tl-row,.faq-item,.door";
  var EXCLUDE_SEL = "#vdEditorPanel,#vdEditorToggle,.site-tabs,#heroSpec,.spectro,.vd-ed-handle,.vd-ed-resize";

  function isExcluded(el) {
    return !!(el && el.closest && el.closest(EXCLUDE_SEL));
  }

  // ---------------------------------------------------------------- styles
  var style = document.createElement("style");
  style.textContent =
    "#vdEditorToggle{position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;" +
    "background:#15161f;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;" +
    "cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.4);z-index:99999;border:2px solid rgba(255,255,255,.15);" +
    "user-select:none;transition:border-color .15s ease}" +
    "#vdEditorToggle.on{border-color:var(--pulse,#7C5CFF)}" +
    "#vdEditorPanel{position:fixed;top:0;right:0;width:280px;height:100vh;background:#15161f;color:#eef0f6;" +
    "border-left:1px solid rgba(255,255,255,.1);z-index:99998;padding:18px 16px;overflow-y:auto;" +
    "transform:translateX(100%);transition:transform .2s ease;font-family:-apple-system,'Segoe UI',sans-serif;" +
    "font-size:12.5px;box-sizing:border-box}" +
    "#vdEditorPanel.show{transform:translateX(0)}" +
    "#vdEditorPanel *{box-sizing:border-box}" +
    "#vdEditorPanel .vd-ed-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}" +
    "#vdEditorPanel .vd-ed-head b{font-size:14px}" +
    "#vdEditorPanel .vd-ed-head button{background:none;border:0;color:#9aa0b4;font-size:16px;cursor:pointer}" +
    "#vdEdEmpty{color:#8a8fa3;line-height:1.5}" +
    "#vdEdFields{display:flex;flex-direction:column;gap:12px}" +
    "#vdEdTag{font-family:ui-monospace,Consolas,monospace;font-size:11px;color:#7C5CFF;" +
    "background:rgba(124,92,255,.12);border-radius:6px;padding:5px 8px;word-break:break-all}" +
    "#vdEdFields label{display:flex;flex-direction:column;gap:5px;font-weight:600;color:#9aa0b4}" +
    "#vdEdFields input[type=number]{background:#0c0d13;border:1px solid rgba(255,255,255,.14);color:#eef0f6;" +
    "border-radius:8px;padding:7px 9px;font-size:13px;width:100%}" +
    "#vdEdFields input[type=color]{width:100%;height:30px;border:1px solid rgba(255,255,255,.14);" +
    "border-radius:8px;background:#0c0d13;padding:2px;cursor:pointer}" +
    "#vdEdFields .vd-ed-check{flex-direction:row;align-items:center;gap:7px;font-weight:500}" +
    "#vdEdFields .vd-ed-row{display:flex;gap:8px;margin:0}" +
    "#vdEdFields button{margin-top:4px;background:rgba(124,92,255,.14);color:#C9BBFF;border:1px solid rgba(124,92,255,.3);" +
    "border-radius:999px;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer;flex:1 1 auto}" +
    "#vdEdFields button.vd-ed-danger,#vdEdFields button#vdEdReset{background:rgba(255,92,138,.14);color:#FF5C8A;" +
    "border-color:rgba(255,92,138,.3)}" +
    ".vd-ed-footer{position:sticky;bottom:0;margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,.1);" +
    "display:flex;flex-direction:column;gap:8px}" +
    ".vd-ed-footer button{width:100%;background:#0c0d13;color:#9aa0b4;border:1px solid rgba(255,255,255,.14);" +
    "border-radius:10px;padding:9px;font-size:12px;font-weight:600;cursor:pointer}" +
    "body.vd-ed-active .vd-ed-hover{outline:1px dashed #7C5CFF;outline-offset:2px;cursor:text}" +
    "body.vd-ed-active .vd-ed-selected{outline:2px solid #7C5CFF !important;outline-offset:2px}" +
    ".vd-ed-handle{display:none;position:absolute;top:4px;left:4px;width:20px;height:20px;background:rgba(10,11,15,.75);" +
    "color:#fff;border-radius:5px;align-items:center;justify-content:center;font-size:12px;cursor:grab;z-index:500;" +
    "user-select:none;line-height:1}" +
    "body.vd-ed-active .vd-ed-handle{display:flex}" +
    ".vd-ed-dragging{opacity:.35}" +
    ".vd-ed-resize{position:absolute;bottom:2px;right:2px;width:16px;height:16px;cursor:nwse-resize;z-index:501;" +
    "background-image:linear-gradient(135deg,transparent 0 46%,#7C5CFF 46% 54%,transparent 54% 100%)," +
    "linear-gradient(135deg,transparent 0 66%,#7C5CFF 66% 74%,transparent 74% 100%);opacity:.85}";
  document.head.appendChild(style);

  // ---------------------------------------------------------------- UI
  var toggle = document.createElement("div");
  toggle.id = "vdEditorToggle";
  toggle.title = "Редактор (вкл/выкл)";
  toggle.textContent = "✏️";
  document.body.appendChild(toggle);

  var panel = document.createElement("aside");
  panel.id = "vdEditorPanel";
  panel.innerHTML =
    '<div class="vd-ed-head"><b>Редактор</b><button id="vdEdClose">✕</button></div>' +
    '<div id="vdEdEmpty">Включите редактор кнопкой ✏️ и кликните на текст, карточку или чип на странице. ' +
    "Перетаскивайте карточки/чипы за значок ⚇ в их углу.</div>" +
    '<div id="vdEdFields" style="display:none">' +
    '<div id="vdEdTag"></div>' +
    "<label>Цвет текста<input type=\"color\" id=\"vdEdColor\"></label>" +
    "<label>Фон<input type=\"color\" id=\"vdEdBg\"></label>" +
    '<label class="vd-ed-check"><input type="checkbox" id="vdEdBgOff"> Без фона (прозрачный)</label>' +
    '<label>Шрифт, px<input type="number" id="vdEdFontSize" min="8" max="140"></label>' +
    '<label>Отступы, px<input type="number" id="vdEdPadding" min="0" max="200"></label>' +
    '<label>Скругление, px<input type="number" id="vdEdRadius" min="0" max="200"></label>' +
    '<label>Ширина, px (авто — пусто)<input type="number" id="vdEdWidth" min="0" max="4000"></label>' +
    '<label>Высота, px (авто — пусто)<input type="number" id="vdEdHeight" min="0" max="4000"></label>' +
    '<div class="vd-ed-row"><button id="vdEdCopyStyle">📋 Копировать стиль</button>' +
    '<button id="vdEdPasteStyle">📥 Вставить стиль</button></div>' +
    '<div class="vd-ed-row"><button id="vdEdDuplicate">➕ Добавить копию</button>' +
    '<button id="vdEdDelete" class="vd-ed-danger">🗑 Удалить</button></div>' +
    '<button id="vdEdReset">Сбросить этот элемент</button>' +
    "</div>" +
    '<div class="vd-ed-footer">' +
    '<button id="vdEdUndo">↶ Отменить последнее</button>' +
    '<button id="vdEdResetAll">Сбросить все правки на странице</button>' +
    "</div>";
  document.body.appendChild(panel);

  var fieldsEl = document.getElementById("vdEdFields");
  var emptyEl = document.getElementById("vdEdEmpty");
  var tagEl = document.getElementById("vdEdTag");
  var colorInput = document.getElementById("vdEdColor");
  var bgInput = document.getElementById("vdEdBg");
  var bgOffInput = document.getElementById("vdEdBgOff");
  var fontSizeInput = document.getElementById("vdEdFontSize");
  var paddingInput = document.getElementById("vdEdPadding");
  var radiusInput = document.getElementById("vdEdRadius");
  var widthInput = document.getElementById("vdEdWidth");
  var heightInput = document.getElementById("vdEdHeight");

  var active = false;
  var currentEl = null;
  var eidCounter = 0;
  var dragEl = null;
  var resizeHandle = null;

  function rgbToHex(rgb) {
    var m = rgb && rgb.match(/\d+/g);
    if (!m) return "#000000";
    return (
      "#" +
      m
        .slice(0, 3)
        .map(function (x) {
          return ("0" + parseInt(x, 10).toString(16)).slice(-2);
        })
        .join("")
    );
  }

  // ------------------------------------------------------- stable ids
  function assignEids() {
    Array.prototype.forEach.call(document.querySelectorAll(SELECTABLE), function (el) {
      if (isExcluded(el)) return;
      if (!el.dataset.eid) el.dataset.eid = "e" + eidCounter++;
    });
  }

  // ------------------------------------------------------- storage
  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function saveState(state) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch (e) {}
  }
  function containerKey(el) {
    return el.id || (el.className && String(el.className).split(" ")[0]) || null;
  }
  function findContainer(key) {
    return document.getElementById(key) || document.getElementsByClassName(key)[0] || null;
  }

  // ------------------------------------------------------- undo
  function loadUndoStack() {
    try {
      return JSON.parse(localStorage.getItem(UNDO_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }
  function pushUndo() {
    try {
      var stack = loadUndoStack();
      stack.push(JSON.stringify(loadState()));
      if (stack.length > UNDO_MAX) stack.shift();
      localStorage.setItem(UNDO_KEY, JSON.stringify(stack));
    } catch (e) {}
  }
  function undo() {
    var stack = loadUndoStack();
    if (!stack.length) return;
    var prev = stack.pop();
    localStorage.setItem(UNDO_KEY, JSON.stringify(stack));
    localStorage.setItem(STORE_KEY, prev);
    location.reload();
  }

  function applyStyleObjectTo(el, s) {
    if (s.color) el.style.color = s.color;
    if (s.bg === "none") el.style.background = "transparent";
    else if (s.bg) el.style.background = s.bg;
    if (s.fontSize) el.style.fontSize = s.fontSize + "px";
    if (s.padding != null) el.style.padding = s.padding + "px";
    if (s.radius != null) el.style.borderRadius = s.radius + "px";
    if (s.width != null) el.style.width = s.width + "px";
    if (s.height != null) el.style.height = s.height + "px";
  }

  function applyState() {
    var state = loadState();
    if (state.text) {
      Object.keys(state.text).forEach(function (eid) {
        var el = document.querySelector('[data-eid="' + eid + '"]');
        if (el) el.innerText = state.text[eid];
      });
    }
    if (state.style) {
      Object.keys(state.style).forEach(function (eid) {
        var el = document.querySelector('[data-eid="' + eid + '"]');
        if (!el) return;
        applyStyleObjectTo(el, state.style[eid]);
      });
    }
    if (state.order) {
      Object.keys(state.order).forEach(function (key) {
        var container = findContainer(key);
        if (!container) return;
        state.order[key].forEach(function (eid) {
          var el = document.querySelector('[data-eid="' + eid + '"]');
          if (el && el.parentNode === container) container.appendChild(el);
        });
      });
    }
  }

  function persistText(el) {
    pushUndo();
    var state = loadState();
    state.text = state.text || {};
    state.text[el.dataset.eid] = el.innerText;
    saveState(state);
  }
  function persistStyle(el, patch) {
    pushUndo();
    var state = loadState();
    state.style = state.style || {};
    state.style[el.dataset.eid] = Object.assign({}, state.style[el.dataset.eid], patch);
    saveState(state);
  }
  function persistOrder(container) {
    var key = containerKey(container);
    if (!key) return;
    var state = loadState();
    state.order = state.order || {};
    state.order[key] = Array.prototype.map
      .call(container.children, function (c) {
        return c.dataset ? c.dataset.eid : null;
      })
      .filter(Boolean);
    saveState(state);
  }
  function resetElement(el) {
    pushUndo();
    var state = loadState();
    var eid = el.dataset.eid;
    if (state.text) delete state.text[eid];
    if (state.style) delete state.style[eid];
    saveState(state);
    el.removeAttribute("style");
  }

  // ------------------------------------------------------- copy/paste style
  var copiedStyle = null;
  function copyStyle(el) {
    var state = loadState();
    copiedStyle =
      state.style && state.style[el.dataset.eid] ? Object.assign({}, state.style[el.dataset.eid]) : {};
    var cs = getComputedStyle(el);
    if (!copiedStyle.color) copiedStyle.color = rgbToHex(cs.color);
    if (copiedStyle.fontSize == null) copiedStyle.fontSize = parseInt(cs.fontSize, 10);
    if (copiedStyle.padding == null) copiedStyle.padding = parseInt(cs.paddingTop, 10);
    if (copiedStyle.radius == null) copiedStyle.radius = parseInt(cs.borderRadius, 10);
  }
  function pasteStyle(el) {
    if (!copiedStyle) return;
    pushUndo();
    applyStyleObjectTo(el, copiedStyle);
    var state = loadState();
    state.style = state.style || {};
    state.style[el.dataset.eid] = Object.assign({}, state.style[el.dataset.eid], copiedStyle);
    saveState(state);
    showFieldsFor(el);
  }

  // ------------------------------------------------------- duplicate/delete
  function duplicateElement(el) {
    pushUndo();
    var clone = el.cloneNode(true);
    Array.prototype.forEach
      .call(clone.querySelectorAll(".vd-ed-handle,.vd-ed-resize"), function (h) {
        h.remove();
      });
    clone.removeAttribute("contenteditable");
    clone.classList.remove("vd-ed-selected", "vd-ed-hover");
    clone.dataset.eid = "e" + eidCounter++;
    el.parentNode.insertBefore(clone, el.nextSibling);

    var state = loadState();
    state.text = state.text || {};
    state.text[clone.dataset.eid] = state.text[el.dataset.eid] != null ? state.text[el.dataset.eid] : clone.innerText;
    if (state.style && state.style[el.dataset.eid]) {
      state.style[clone.dataset.eid] = Object.assign({}, state.style[el.dataset.eid]);
    }
    saveState(state);
    persistOrder(el.parentNode);
    addHandles();
    selectEl(clone);
  }
  function deleteElement(el) {
    // no blocking confirm() dialog here — relies on Undo as the safety net instead,
    // since native confirm()/alert() are unreliable in embedded/preview browser contexts.
    pushUndo();
    var parent = el.parentNode;
    var eid = el.dataset.eid;
    deselect();
    parent.removeChild(el);
    var state = loadState();
    if (state.text) delete state.text[eid];
    if (state.style) delete state.style[eid];
    saveState(state);
    persistOrder(parent);
  }

  // ------------------------------------------------------- selection
  function selectEl(el) {
    if (currentEl && currentEl !== el) {
      currentEl.removeAttribute("contenteditable");
      currentEl.classList.remove("vd-ed-selected");
      removeResizeHandle();
    }
    currentEl = el;
    el.classList.add("vd-ed-selected");
    el.setAttribute("contenteditable", "true");
    el.focus();
    showFieldsFor(el);
    addResizeHandle(el);
  }
  function deselect() {
    if (currentEl) {
      currentEl.removeAttribute("contenteditable");
      currentEl.classList.remove("vd-ed-selected");
      removeResizeHandle();
    }
    currentEl = null;
    fieldsEl.style.display = "none";
    emptyEl.style.display = "block";
  }
  function showFieldsFor(el) {
    emptyEl.style.display = "none";
    fieldsEl.style.display = "flex";
    fieldsEl.style.flexDirection = "column";
    var realClass = String(el.className || "")
      .split(" ")
      .filter(function (c) {
        return c && c.indexOf("vd-ed-") !== 0;
      })[0];
    tagEl.textContent = el.tagName.toLowerCase() + (realClass ? "." + realClass : "");
    var cs = getComputedStyle(el);
    colorInput.value = rgbToHex(cs.color);
    fontSizeInput.value = parseInt(cs.fontSize, 10) || 14;
    paddingInput.value = parseInt(cs.paddingTop, 10) || 0;
    radiusInput.value = parseInt(cs.borderRadius, 10) || 0;
    widthInput.value = el.style.width ? parseInt(el.style.width, 10) : "";
    heightInput.value = el.style.height ? parseInt(el.style.height, 10) : "";
    bgOffInput.checked = false;
  }

  // ------------------------------------------------------- resize handle
  function addResizeHandle(el) {
    var cs = getComputedStyle(el);
    if (cs.position === "static") el.style.position = "relative";
    resizeHandle = document.createElement("span");
    resizeHandle.className = "vd-ed-resize";
    resizeHandle.setAttribute("contenteditable", "false");
    el.appendChild(resizeHandle);
    resizeHandle.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      e.stopPropagation();
      resizeHandle.setPointerCapture(e.pointerId);
      var startX = e.clientX,
        startY = e.clientY;
      var rect = el.getBoundingClientRect();
      var startW = rect.width,
        startH = rect.height;
      function onMove(ev) {
        var w = Math.max(20, Math.round(startW + (ev.clientX - startX)));
        var h = Math.max(20, Math.round(startH + (ev.clientY - startY)));
        el.style.width = w + "px";
        el.style.height = h + "px";
        widthInput.value = w;
        heightInput.value = h;
      }
      function onUp(ev) {
        resizeHandle.releasePointerCapture(ev.pointerId);
        resizeHandle.removeEventListener("pointermove", onMove);
        resizeHandle.removeEventListener("pointerup", onUp);
        persistStyle(el, { width: parseInt(el.style.width, 10), height: parseInt(el.style.height, 10) });
      }
      resizeHandle.addEventListener("pointermove", onMove);
      resizeHandle.addEventListener("pointerup", onUp);
    });
  }
  function removeResizeHandle() {
    if (resizeHandle && resizeHandle.parentNode) resizeHandle.parentNode.removeChild(resizeHandle);
    resizeHandle = null;
  }

  // ------------------------------------------------------- events
  document.addEventListener(
    "click",
    function (e) {
      if (!active) return;
      if (isExcluded(e.target)) return;
      var el = e.target.closest(SELECTABLE);
      if (!el || isExcluded(el)) return;
      e.preventDefault();
      e.stopPropagation();
      selectEl(el);
    },
    true
  );

  document.addEventListener("mouseover", function (e) {
    if (!active) return;
    if (isExcluded(e.target)) return;
    var el = e.target.closest(SELECTABLE);
    if (el && !isExcluded(el)) el.classList.add("vd-ed-hover");
  });
  document.addEventListener("mouseout", function (e) {
    if (!active) return;
    var el = e.target.closest && e.target.closest(SELECTABLE);
    if (el) el.classList.remove("vd-ed-hover");
  });

  document.addEventListener(
    "input",
    function (e) {
      if (!active || !currentEl || e.target !== currentEl) return;
      persistText(currentEl);
    },
    true
  );

  colorInput.addEventListener("input", function () {
    if (!currentEl) return;
    currentEl.style.color = this.value;
    persistStyle(currentEl, { color: this.value });
  });
  bgInput.addEventListener("input", function () {
    if (!currentEl) return;
    bgOffInput.checked = false;
    currentEl.style.background = this.value;
    persistStyle(currentEl, { bg: this.value });
  });
  bgOffInput.addEventListener("change", function () {
    if (!currentEl || !this.checked) return;
    currentEl.style.background = "transparent";
    persistStyle(currentEl, { bg: "none" });
  });
  fontSizeInput.addEventListener("input", function () {
    if (!currentEl) return;
    currentEl.style.fontSize = this.value + "px";
    persistStyle(currentEl, { fontSize: this.value });
  });
  paddingInput.addEventListener("input", function () {
    if (!currentEl) return;
    currentEl.style.padding = this.value + "px";
    persistStyle(currentEl, { padding: this.value });
  });
  radiusInput.addEventListener("input", function () {
    if (!currentEl) return;
    currentEl.style.borderRadius = this.value + "px";
    persistStyle(currentEl, { radius: this.value });
  });
  widthInput.addEventListener("input", function () {
    if (!currentEl) return;
    if (this.value === "") {
      currentEl.style.width = "";
      persistStyle(currentEl, { width: null });
      return;
    }
    currentEl.style.width = this.value + "px";
    persistStyle(currentEl, { width: this.value });
  });
  heightInput.addEventListener("input", function () {
    if (!currentEl) return;
    if (this.value === "") {
      currentEl.style.height = "";
      persistStyle(currentEl, { height: null });
      return;
    }
    currentEl.style.height = this.value + "px";
    persistStyle(currentEl, { height: this.value });
  });
  document.getElementById("vdEdReset").addEventListener("click", function () {
    if (!currentEl) return;
    resetElement(currentEl);
    showFieldsFor(currentEl);
  });
  document.getElementById("vdEdCopyStyle").addEventListener("click", function () {
    if (!currentEl) return;
    copyStyle(currentEl);
  });
  document.getElementById("vdEdPasteStyle").addEventListener("click", function () {
    if (!currentEl) return;
    pasteStyle(currentEl);
  });
  document.getElementById("vdEdDuplicate").addEventListener("click", function () {
    if (!currentEl) return;
    duplicateElement(currentEl);
  });
  document.getElementById("vdEdDelete").addEventListener("click", function () {
    if (!currentEl) return;
    deleteElement(currentEl);
  });
  document.getElementById("vdEdUndo").addEventListener("click", undo);
  // Two-step "arm then confirm" instead of a blocking confirm() dialog, which is
  // unreliable in embedded/preview browser contexts (often auto-dismissed).
  var resetAllBtn = document.getElementById("vdEdResetAll");
  var resetAllArmed = false;
  var resetAllTimer = null;
  var resetAllLabel = resetAllBtn.textContent;
  resetAllBtn.addEventListener("click", function () {
    if (!resetAllArmed) {
      resetAllArmed = true;
      resetAllBtn.textContent = "Точно? Нажмите ещё раз";
      resetAllTimer = setTimeout(function () {
        resetAllArmed = false;
        resetAllBtn.textContent = resetAllLabel;
      }, 4000);
      return;
    }
    clearTimeout(resetAllTimer);
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(UNDO_KEY);
    location.reload();
  });
  document.getElementById("vdEdClose").addEventListener("click", function () {
    setActive(false);
  });
  toggle.addEventListener("click", function () {
    setActive(!active);
  });
  document.addEventListener("keydown", function (e) {
    if (!active) return;
    if (document.activeElement && document.activeElement.isContentEditable) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      undo();
    }
  });

  function setActive(v) {
    active = v;
    document.body.classList.toggle("vd-ed-active", active);
    panel.classList.toggle("show", active);
    toggle.classList.toggle("on", active);
    if (!active) deselect();
  }

  // ------------------------------------------------------- drag reorder
  function addHandles() {
    Array.prototype.forEach.call(document.querySelectorAll(DRAGGABLE), function (el) {
      if (isExcluded(el)) return;
      if (el.querySelector(":scope > .vd-ed-handle")) return;
      var cs = getComputedStyle(el);
      if (cs.position === "static") el.style.position = "relative";
      var h = document.createElement("span");
      h.className = "vd-ed-handle";
      h.textContent = "⚇";
      h.draggable = true;
      h.addEventListener("dragstart", function (e) {
        dragEl = el;
        el.classList.add("vd-ed-dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", el.dataset.eid || "");
      });
      h.addEventListener("dragend", function () {
        if (dragEl) {
          dragEl.classList.remove("vd-ed-dragging");
          persistOrder(dragEl.parentNode);
        }
        dragEl = null;
      });
      el.appendChild(h);
    });
  }
  document.addEventListener("dragover", function (e) {
    if (!active || !dragEl) return;
    var target = e.target.closest(DRAGGABLE);
    if (!target || target === dragEl) return;
    e.preventDefault();
    var rect = target.getBoundingClientRect();
    var before = e.clientY - rect.top < rect.height / 2;
    target.parentNode.insertBefore(dragEl, before ? target : target.nextSibling);
  });

  // ------------------------------------------------------- init
  assignEids();
  applyState();
  addHandles();
})();
