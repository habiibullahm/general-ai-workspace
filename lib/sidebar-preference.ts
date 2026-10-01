// Desktop history column: expanded by default. Stored per device and applied before first paint (see app/layout.tsx).
export const sidebarStorageKey = "nibie-sidebar";

export const sidebarInitScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(sidebarStorageKey)})==="collapsed")document.documentElement.setAttribute("data-sidebar","collapsed")}catch(e){}})()`;

function applySidebar(collapsed: boolean) {
  if (collapsed) document.documentElement.setAttribute("data-sidebar", "collapsed");
  else document.documentElement.removeAttribute("data-sidebar");
}

// Re-applies the saved choice after mount. A dev remount clears attributes the head script set outside React.
export function restoreSidebarPreference() {
  try { applySidebar(localStorage.getItem(sidebarStorageKey) === "collapsed"); } catch { /* leave whatever the pre-paint script set */ }
}

export function setSidebarCollapsed(collapsed: boolean) {
  try { localStorage.setItem(sidebarStorageKey, collapsed ? "collapsed" : "expanded"); } catch { /* the choice is simply not remembered */ }
  applySidebar(collapsed);
}
