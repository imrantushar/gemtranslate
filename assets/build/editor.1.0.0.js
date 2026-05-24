/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./dev_zentranslate/editor/editor.css"
/*!********************************************!*\
  !*** ./dev_zentranslate/editor/editor.css ***!
  \********************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
// extracted by mini-css-extract-plugin


/***/ },

/***/ "react/jsx-runtime"
/*!**********************************!*\
  !*** external "ReactJSXRuntime" ***!
  \**********************************/
(module) {

module.exports = window["ReactJSXRuntime"];

/***/ },

/***/ "@wordpress/components"
/*!************************************!*\
  !*** external ["wp","components"] ***!
  \************************************/
(module) {

module.exports = window["wp"]["components"];

/***/ },

/***/ "@wordpress/data"
/*!******************************!*\
  !*** external ["wp","data"] ***!
  \******************************/
(module) {

module.exports = window["wp"]["data"];

/***/ },

/***/ "@wordpress/edit-post"
/*!**********************************!*\
  !*** external ["wp","editPost"] ***!
  \**********************************/
(module) {

module.exports = window["wp"]["editPost"];

/***/ },

/***/ "@wordpress/element"
/*!*********************************!*\
  !*** external ["wp","element"] ***!
  \*********************************/
(module) {

module.exports = window["wp"]["element"];

/***/ },

/***/ "@wordpress/i18n"
/*!******************************!*\
  !*** external ["wp","i18n"] ***!
  \******************************/
(module) {

module.exports = window["wp"]["i18n"];

/***/ },

/***/ "@wordpress/plugins"
/*!*********************************!*\
  !*** external ["wp","plugins"] ***!
  \*********************************/
(module) {

module.exports = window["wp"]["plugins"];

/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			var e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!*******************************************!*\
  !*** ./dev_zentranslate/editor/index.jsx ***!
  \*******************************************/
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _wordpress_plugins__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @wordpress/plugins */ "@wordpress/plugins");
/* harmony import */ var _wordpress_plugins__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_wordpress_plugins__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _wordpress_edit_post__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @wordpress/edit-post */ "@wordpress/edit-post");
/* harmony import */ var _wordpress_edit_post__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_wordpress_edit_post__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @wordpress/data */ "@wordpress/data");
/* harmony import */ var _wordpress_data__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_wordpress_data__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @wordpress/i18n */ "@wordpress/i18n");
/* harmony import */ var _wordpress_i18n__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @wordpress/components */ "@wordpress/components");
/* harmony import */ var _wordpress_components__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(_wordpress_components__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @wordpress/element */ "@wordpress/element");
/* harmony import */ var _wordpress_element__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(_wordpress_element__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var _editor_css__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./editor.css */ "./dev_zentranslate/editor/editor.css");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! react/jsx-runtime */ "react/jsx-runtime");
/* harmony import */ var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7___default = /*#__PURE__*/__webpack_require__.n(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__);








const config = window.ztrans || {};
async function api(path, init = {}) {
  const url = config.root + path.replace(/^\//, '');
  const res = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-WP-Nonce': config.nonce || '',
      ...(init.headers || {})
    },
    ...init
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message || res.statusText);
  }
  return body?.data ?? body;
}
function ZentranslateSidebar() {
  const postId = (0,_wordpress_data__WEBPACK_IMPORTED_MODULE_2__.useSelect)(s => s('core/editor').getCurrentPostId(), []);
  const [languages, setLanguages] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_5__.useState)([]);
  const [statuses, setStatuses] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_5__.useState)({});
  const [busy, setBusy] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_5__.useState)({});
  const [error, setError] = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_5__.useState)(null);
  const refresh = (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_5__.useCallback)(async () => {
    if (!postId) return;
    try {
      const langs = await api('languages?active=true');
      setLanguages(langs);
      const translations = await api(`posts/${postId}/translations`);
      const map = {};
      (translations?.translations || []).forEach(t => {
        map[t.language.code] = t.translation?.status || null;
      });
      setStatuses(map);
    } catch (err) {
      setError(err.message);
    }
  }, [postId]);
  (0,_wordpress_element__WEBPACK_IMPORTED_MODULE_5__.useEffect)(() => {
    refresh();
  }, [refresh]);
  const queueTranslate = async langCode => {
    setBusy(b => ({
      ...b,
      [langCode]: true
    }));
    try {
      await api('jobs', {
        method: 'POST',
        body: JSON.stringify({
          post_id: postId,
          target_lang: langCode,
          options: {
            use_memory: true,
            preserve_html: true,
            overwrite: false
          }
        })
      });
      setStatuses(s => ({
        ...s,
        [langCode]: 'queued'
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(b => ({
        ...b,
        [langCode]: false
      }));
    }
  };
  const nonDefault = languages.filter(l => !l.is_default);
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_wordpress_edit_post__WEBPACK_IMPORTED_MODULE_1__.PluginSidebar, {
    name: "zentranslate-sidebar",
    title: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('Zentranslate', 'zentranslate'),
    icon: "translation",
    children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(_wordpress_components__WEBPACK_IMPORTED_MODULE_4__.PanelBody, {
      title: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('Translation status', 'zentranslate'),
      initialOpen: true,
      children: [error && /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("p", {
        style: {
          color: '#dc2626'
        },
        children: error
      }), languages.length === 0 ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("p", {
        children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_4__.Spinner, {}), " ", (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('Loading languages…', 'zentranslate')]
      }) : nonDefault.length === 0 ? /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("p", {
        children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('Add a non-default language in Zentranslate to start translating.', 'zentranslate')
      }) : /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("table", {
        style: {
          width: '100%',
          fontSize: 12
        },
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("tbody", {
          children: nonDefault.map(l => {
            const status = statuses[l.code];
            const isBusy = busy[l.code];
            return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("tr", {
              children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("td", {
                style: {
                  paddingBottom: 6
                },
                children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("strong", {
                  children: l.name
                }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("div", {
                  style: {
                    color: '#6b7280'
                  },
                  children: l.code
                })]
              }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("td", {
                style: {
                  paddingBottom: 6
                },
                children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("span", {
                  style: {
                    padding: '2px 6px',
                    borderRadius: 999,
                    background: status ? '#dcfce7' : '#f3f4f6',
                    color: status ? '#166534' : '#6b7280'
                  },
                  children: status || (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('—', 'zentranslate')
                })
              }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("td", {
                style: {
                  paddingBottom: 6,
                  textAlign: 'right'
                },
                children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)("div", {
                  style: {
                    display: 'flex',
                    gap: 4,
                    justifyContent: 'flex-end'
                  },
                  children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_4__.Button, {
                    size: "small",
                    variant: "secondary",
                    isBusy: isBusy,
                    onClick: () => queueTranslate(l.code),
                    children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('AI', 'zentranslate')
                  }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_4__.Button, {
                    size: "small",
                    href: `${config.adminUrl}admin.php?page=zentranslate#/posts/${postId}`,
                    target: "_blank",
                    children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('Edit', 'zentranslate')
                  })]
                })
              })]
            }, l.code);
          })
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("p", {
        style: {
          marginTop: 12
        },
        children: /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_wordpress_components__WEBPACK_IMPORTED_MODULE_4__.Button, {
          variant: "link",
          onClick: refresh,
          children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('Refresh', 'zentranslate')
        })
      }), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)("p", {
        style: {
          fontSize: 11,
          color: '#6b7280'
        },
        children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('AI queues a background job. Progress is visible in Zentranslate → Jobs.', 'zentranslate')
      })]
    })
  });
}
function ZentranslateMoreItem() {
  return /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(_wordpress_edit_post__WEBPACK_IMPORTED_MODULE_1__.PluginSidebarMoreMenuItem, {
    target: "zentranslate-sidebar",
    icon: "translation",
    children: (0,_wordpress_i18n__WEBPACK_IMPORTED_MODULE_3__.__)('Zentranslate', 'zentranslate')
  });
}
(0,_wordpress_plugins__WEBPACK_IMPORTED_MODULE_0__.registerPlugin)('zentranslate-editor', {
  render: () => /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.Fragment, {
    children: [/*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ZentranslateMoreItem, {}), /*#__PURE__*/(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_7__.jsx)(ZentranslateSidebar, {})]
  })
});
})();

/******/ })()
;
//# sourceMappingURL=editor.1.0.0.js.map