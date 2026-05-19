// Renders the Tasko sidebar into a placeholder element.
// Usage: include <div id="sidebar" data-current="today"></div> in markup,
// then load this script at end of body.
// Self-contained — no fetch, works from file:// URLs.
(() => {
  function icon(svgInner, size) {
    var s = size || 20;
    return (
      '<svg width="' +
      s +
      '" height="' +
      s +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      svgInner +
      '</svg>'
    );
  }

  var icons = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M5 5l1.5 1.5M17.5 17.5L19 19M2 12h2M20 12h2M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    sunrise:
      '<path d="M22 14H2"/><path d="M22 18H2"/><path d="M22 10 22 6"/><path d="M2 10 2 6"/><path d="M2 6h20"/><path d="M12 2v4"/>',
    calendar:
      '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>',
    calendarDays:
      '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    inbox:
      '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    chevronDown: '<polyline points="6 9 12 15 18 9"/>',
    folder:
      '<path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2"/>',
    hash: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>',
    settings:
      '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    cloudCheck:
      '<path d="M17.5 19a4.5 4.5 0 1 0 0-9h-1.8A7 7 0 1 0 4 14.9"/><polyline points="9 13 12 16 22 6"/>',
  };

  function navItem(opts) {
    var sel = opts.selected ? ' is-selected' : '';
    var current = opts.selected ? ' aria-current="page"' : '';
    var count = opts.count ? '<span class="nav-item__count">' + opts.count + '</span>' : '';
    var overdue = opts.overdue
      ? '<span class="nav-item__overdue-pill" title="' +
        opts.overdue +
        ' overdue">' +
        opts.overdue +
        '</span>'
      : '';
    var iconHtml = '';
    if (opts.icon) iconHtml = icon(icons[opts.icon], 20);
    else if (opts.dot) iconHtml = '<span class="project-dot" style="background:' + opts.dot + '"></span>';
    return (
      '<a href="' +
      (opts.href || '#') +
      '" class="nav-item' +
      sel +
      '"' +
      current +
      '>' +
      iconHtml +
      '<span class="nav-item__label">' +
      opts.label +
      '</span>' +
      count +
      overdue +
      '</a>'
    );
  }

  function folderRow(label) {
    return (
      '<div class="folder-row">' +
      '<svg class="folder-row__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      icons.chevronDown +
      '</svg>' +
      icon(icons.folder, 16) +
      '<span>' +
      label +
      '</span>' +
      '</div>'
    );
  }

  function render(currentId) {
    var html = '';
    html += '<div class="sidebar__logo">Tasko</div>';

    html += navItem({
      href: 'today.html',
      label: 'Today',
      icon: 'sun',
      count: 5,
      overdue: 3,
      selected: currentId === 'today',
    });
    html += navItem({
      href: '#',
      label: 'Tomorrow',
      icon: 'sunrise',
      count: 3,
      selected: currentId === 'tomorrow',
    });
    html += navItem({
      href: '#',
      label: 'Next 7 Days',
      icon: 'calendarDays',
      count: 12,
      selected: currentId === 'next7',
    });
    html += navItem({
      href: 'inbox.html',
      label: 'Inbox',
      icon: 'inbox',
      count: 8,
      selected: currentId === 'inbox',
    });
    html += navItem({
      href: '#',
      label: 'All',
      icon: 'list',
      count: 47,
      selected: currentId === 'all',
    });

    html +=
      '<div class="sidebar__section-header">' +
      '<span>Projects</span>' +
      '<button class="icon-btn icon-btn--sm" aria-label="New project">' +
      icon(icons.plus, 14) +
      '</button>' +
      '</div>';

    html += folderRow('Personal');
    html += '<div class="project-children">';
    html += navItem({ label: 'Errands', dot: '#3b82f6', count: 3 });
    html += navItem({ label: 'Reading list', dot: '#a855f7', count: 12 });
    html += '</div>';

    html += folderRow('Work');
    html += '<div class="project-children">';
    html += navItem({
      href: 'project-tree.html',
      label: 'Q3 Launch',
      dot: '#f59e0b',
      count: 24,
      selected: currentId === 'q3launch',
    });
    html += navItem({ label: 'Side project', dot: '#14b8a6', count: 6 });
    html += '</div>';

    html += navItem({ label: '2026 goals', dot: '#6366f1', count: 4 });

    html += '<div class="sidebar__section-header"><span>Tags</span></div>';
    html += navItem({ label: 'urgent', icon: 'hash', count: 6 });
    html += navItem({ label: 'waiting', icon: 'hash', count: 3 });
    html += navItem({ label: 'call', icon: 'hash', count: 2 });

    html += '<div style="height: 1px; background: var(--border-subtle); margin: 16px 8px;"></div>';

    html += navItem({
      href: 'calendar-month.html',
      label: 'Calendar',
      icon: 'calendar',
      selected: currentId === 'calendar',
    });
    html += navItem({ label: 'Completed', icon: 'checkCircle' });
    html += navItem({ label: 'Trash', icon: 'trash', count: 5 });
    html += navItem({ label: 'Settings', icon: 'settings' });

    html +=
      '<div class="sidebar__sync">' + icon(icons.cloudCheck, 14) + '<span>Synced 1m ago</span>' + '</div>';

    return html;
  }

  document.addEventListener('DOMContentLoaded', () => {
    var el = document.getElementById('sidebar');
    if (!el) return;
    var current = el.getAttribute('data-current') || '';
    el.innerHTML = render(current);
  });
})();
