/**
 * CDC Performance Index & Leaderboard
 * Client Application Logic
 */

let allStudents = [];
let filteredStudents = [];
let currentBranch = 'ALL';
let currentGroup = 'ALL';
let currentSortKey = 'total_assessment';
let sortDirection = 'desc'; // 'desc' or 'asc'
let currentPage = 1;
const PAGE_SIZE = 50;

// Exclude A1 Toggle State
let isExcludeA1 = false;
let currentModalStudent = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const branchButtons = document.querySelectorAll('#branchFilter .seg-btn');
const groupFilter = document.getElementById('groupFilter');
const sortBySelect = document.getElementById('sortBy');
const rankingBody = document.getElementById('rankingBody');
const resultsCount = document.getElementById('resultsCount');
const currentScopeTag = document.getElementById('currentScopeTag');
const podiumContainer = document.getElementById('podiumCards');
const pageInfo = document.getElementById('pageInfo');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');

// EXCLUDE A1 Button
const excludeA1Btn = document.getElementById('excludeA1Btn');
const excludeA1State = document.getElementById('excludeA1State');

// Vertical Search Dropdown Container
const searchDropdown = document.getElementById('searchDropdown');
const searchDropdownList = document.getElementById('searchDropdownList');
const searchDropdownCount = document.getElementById('searchDropdownCount');

// Modal
const reportModal = document.getElementById('reportModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');

// Metric Strip Elements
const statTotalStudents = document.getElementById('statTotalStudents');
const statHighestScore = document.getElementById('statHighestScore');
const statHighestName = document.getElementById('statHighestName');
const statAvgScore = document.getElementById('statAvgScore');
const statAvgPct = document.getElementById('statAvgPct');
const statTopScorers = document.getElementById('statTopScorers');
const statTotalGroups = document.getElementById('statTotalGroups');

// Standard comparator based on Assessment Marks
function assessmentComparator(a, b) {
  const scoreA = Number(a.effectiveAssessment || 0);
  const scoreB = Number(b.effectiveAssessment || 0);
  if (scoreB !== scoreA) return scoreB - scoreA;

  const a3_B = Number(b.assessment3_num || 0);
  const a3_A = Number(a.assessment3_num || 0);
  if (a3_B !== a3_A) return a3_B - a3_A;

  const a2_B = Number(b.assessment2_num || 0);
  const a2_A = Number(a.assessment2_num || 0);
  if (a2_B !== a2_A) return a2_B - a2_A;

  if (!isExcludeA1) {
    const a1_B = Number(b.assessment1_num || 0);
    const a1_A = Number(a.assessment1_num || 0);
    if (a1_B !== a1_A) return a1_B - a1_A;
  }

  return String(a.rollNo || '').localeCompare(String(b.rollNo || ''));
}

// Compute persistent batch, branch, and group ranks
function calculateAllRanks() {
  // Precalculate student effective marks & max
  allStudents.forEach(s => {
    if (isExcludeA1) {
      s.effectiveAssessment = (s.assessment2_num || 0) + (s.assessment3_num || 0);
      s.maxAssessment = 1000;
    } else {
      s.effectiveAssessment = s.total_assessment || ((s.assessment1_num || 0) + (s.assessment2_num || 0) + (s.assessment3_num || 0));
      s.maxAssessment = 1500;
    }
  });

  // 1. Overall Batch Rank
  const overallSorted = [...allStudents].sort(assessmentComparator);
  overallSorted.forEach((s, idx) => {
    s.overallRank = idx + 1;
  });

  // 2. Branch Rank (within each engineering department)
  const branchMap = {};
  allStudents.forEach(s => {
    const b = s.branch || 'Unknown';
    if (!branchMap[b]) branchMap[b] = [];
    branchMap[b].push(s);
  });
  Object.values(branchMap).forEach(list => {
    list.sort(assessmentComparator);
    list.forEach((s, idx) => {
      s.branchRank = idx + 1;
      s.branchTotal = list.length;
    });
  });

  // 3. Group Rank (within each training group)
  const groupMap = {};
  allStudents.forEach(s => {
    const g = (s.cycle1 && s.cycle1 !== '-') ? s.cycle1 : ((s.cycle2 && s.cycle2 !== '-') ? s.cycle2 : 'Unassigned');
    s.resolvedGroup = g;
    if (!groupMap[g]) groupMap[g] = [];
    groupMap[g].push(s);
  });
  Object.values(groupMap).forEach(list => {
    list.sort(assessmentComparator);
    list.forEach((s, idx) => {
      s.groupRank = idx + 1;
      s.groupTotal = list.length;
    });
  });
}

// ==========================================
// Initialization
// ==========================================
async function init() {
  try {
    const resp = await fetch('data/students.json');
    if (!resp.ok) {
      throw new Error(`Failed to load data: ${resp.status}`);
    }
    allStudents = await resp.json();
    console.log(`Loaded ${allStudents.length} students`);
    
    calculateAllRanks();
    populateGroupFilter();
    updateBatchMetrics(allStudents);
    applyFiltersAndSort();
  } catch (err) {
    console.error('Data load error:', err);
    resultsCount.textContent = 'Error loading student data. Check console.';
  }
}

// Populate unique groups dynamically
function populateGroupFilter() {
  const groups = new Set();
  allStudents.forEach(s => {
    if (s.resolvedGroup && s.resolvedGroup !== 'Unassigned') {
      groups.add(s.resolvedGroup);
    }
  });

  const sortedGroups = Array.from(groups).sort();
  groupFilter.innerHTML = '<option value="ALL">All Training Groups</option>';
  sortedGroups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g;
    opt.textContent = g;
    groupFilter.appendChild(opt);
  });

  if (statTotalGroups) {
    statTotalGroups.textContent = `${sortedGroups.length} Sections`;
  }
}

// Calculate top-level batch metrics
function updateBatchMetrics(dataset) {
  if (!dataset || dataset.length === 0) return;

  if (statTotalStudents) {
    statTotalStudents.textContent = dataset.length.toLocaleString();
  }

  const maxPossible = isExcludeA1 ? 1000 : 1500;
  const threshold75 = isExcludeA1 ? 750 : 1125;

  let highestScore = -1;
  let topStudent = null;
  let totalScoreSum = 0;
  let topScorersCount = 0;

  dataset.forEach(s => {
    const score = Number(s.effectiveAssessment || 0);
    if (score > highestScore) {
      highestScore = score;
      topStudent = s;
    }
    totalScoreSum += score;
    if (score >= threshold75) {
      topScorersCount++;
    }
  });

  const avgScore = totalScoreSum / dataset.length;
  const avgPct = ((avgScore / maxPossible) * 100).toFixed(1);

  if (statHighestScore) {
    statHighestScore.textContent = highestScore >= 0 ? `${highestScore} / ${maxPossible}` : '--';
  }
  if (statHighestName) {
    statHighestName.textContent = topStudent ? `${topStudent.name} (${topStudent.branch || ''})` : '--';
  }
  if (statAvgScore) {
    statAvgScore.textContent = `${Math.round(avgScore)} / ${maxPossible}`;
  }
  if (statAvgPct) {
    statAvgPct.textContent = `${avgPct}% Avg Score`;
  }
  if (statTopScorers) {
    statTopScorers.textContent = `${topScorersCount.toLocaleString()} Students`;
  }
}

function hasValidUrl(url) {
  return url && typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
}

// ==========================================
// Filtering & Ranking Logic
// ==========================================
function applyFiltersAndSort() {
  const query = searchInput.value.trim().toLowerCase();

  // 1. Scoped students by Branch and Training Group
  const scopedStudents = allStudents.filter(s => {
    // Branch Filter
    if (currentBranch !== 'ALL' && s.branch !== currentBranch) {
      return false;
    }

    // Group Filter
    if (currentGroup !== 'ALL') {
      const c1 = s.cycle1 || '';
      const c2 = s.cycle2 || '';
      if (c1 !== currentGroup && c2 !== currentGroup) {
        return false;
      }
    }

    return true;
  });

  // 2. Sort scoped students strictly by selected key with assessment priority tie-breaking
  scopedStudents.sort((a, b) => {
    if (currentSortKey === 'total_assessment') {
      const scoreA = Number(a.effectiveAssessment || 0);
      const scoreB = Number(b.effectiveAssessment || 0);
      if (scoreA !== scoreB) {
        return sortDirection === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      }
    } else if (currentSortKey === 'rollNo') {
      let valA = a.rollNo || '';
      let valB = b.rollNo || '';
      return sortDirection === 'asc' ? String(valA).localeCompare(String(valB)) : String(valB).localeCompare(String(valA));
    } else if (currentSortKey === 'branchRank' || currentSortKey === 'groupRank') {
      const rankA = Number(a[currentSortKey]) || 99999;
      const rankB = Number(b[currentSortKey]) || 99999;
      return sortDirection === 'desc' ? rankA - rankB : rankB - rankA;
    } else {
      let valA = a[currentSortKey];
      let valB = b[currentSortKey];
      if (valA === undefined || valA === null) valA = 0;
      if (valB === undefined || valB === null) valB = 0;
      const numA = Number(valA);
      const numB = Number(valB);
      if (numA !== numB) {
        return sortDirection === 'desc' ? numB - numA : numA - numB;
      }
    }

    // Secondary tie-breakers: Assessment 3, Assessment 2, Assessment 1 (if not excluded), then Roll No
    if ((b.effectiveAssessment || 0) !== (a.effectiveAssessment || 0) && currentSortKey !== 'total_assessment') {
      return (b.effectiveAssessment || 0) - (a.effectiveAssessment || 0);
    }
    if ((b.assessment3_num || 0) !== (a.assessment3_num || 0)) {
      return (b.assessment3_num || 0) - (a.assessment3_num || 0);
    }
    if ((b.assessment2_num || 0) !== (a.assessment2_num || 0)) {
      return (b.assessment2_num || 0) - (a.assessment2_num || 0);
    }
    if (!isExcludeA1 && (b.assessment1_num || 0) !== (a.assessment1_num || 0)) {
      return (b.assessment1_num || 0) - (a.assessment1_num || 0);
    }
    return String(a.rollNo || '').localeCompare(String(b.rollNo || ''));
  });

  // Assign every student their exact true rank in this cohort/branch!
  scopedStudents.forEach((s, idx) => {
    s.scopeRank = idx + 1;
  });

  // 3. Exact Top 3 students for 1st, 2nd, 3rd position are hardcoded/fixed from scopedStudents!
  const top3 = scopedStudents.slice(0, 3);

  // 4. Now filter for the table based on search query (in real-time)
  if (query) {
    filteredStudents = scopedStudents.filter(s => {
      const name = (s.name || '').toLowerCase();
      const roll = (s.rollNo || '').toLowerCase();
      return name.includes(query) || roll.includes(query);
    });
  } else {
    filteredStudents = scopedStudents;
  }

  // Reset pagination
  currentPage = 1;
  updateScopeTag(query);
  renderPodium(top3);
  renderSearchDropdown(query);
  renderTable();
}

function updateScopeTag(query) {
  let scope = 'Overall Ranking';
  if (currentBranch !== 'ALL') {
    scope = `${currentBranch} Branch Ranking`;
  }
  if (currentGroup !== 'ALL') {
    scope += ` • Group ${currentGroup}`;
  }
  if (isExcludeA1) {
    scope += ' • [A1 Excluded]';
  }
  if (query) {
    currentScopeTag.textContent = `${scope} • Query: "${query}"`;
    resultsCount.textContent = `${filteredStudents.length} Found (Real-Time Ranks Shown)`;
  } else {
    currentScopeTag.textContent = scope;
    resultsCount.textContent = `${filteredStudents.length} Students Ranked`;
  }
}

// ==========================================
// Render Vertical Search Dropdown (Matches user screenshot)
// ==========================================
function renderSearchDropdown(query) {
  if (!searchDropdown || !searchDropdownList) return;

  if (!query) {
    searchDropdown.style.display = 'none';
    searchDropdownList.innerHTML = '';
    return;
  }

  const matches = filteredStudents || [];
  searchDropdown.style.display = 'block';
  searchDropdownList.innerHTML = '';

  if (searchDropdownCount) {
    searchDropdownCount.textContent = `${matches.length} Matching Student${matches.length === 1 ? '' : 's'}`;
  }

  if (matches.length === 0) {
    searchDropdownList.innerHTML = `
      <div class="search-dropdown-empty">
        No students found matching "${escapeHtml(query)}"
      </div>
    `;
    return;
  }

  // Render top 15 matching rows vertically
  const rowsToRender = matches.slice(0, 15);
  const maxPossible = isExcludeA1 ? 1000 : 1500;

  rowsToRender.forEach(s => {
    const row = document.createElement('div');
    row.className = 'search-row-item';
    row.onclick = (e) => {
      e.stopPropagation();
      openStudentModal(s);
    };

    const branchClass = `branch-${s.branch || ''}`;
    const groupText = s.cycle1 ? `28ACSE Section ${s.cycle1}` : (s.cycle2 ? `28ACSE Section ${s.cycle2}` : '');
    const scoreVal = s.effectiveAssessment || 0;

    row.innerHTML = `
      <div class="search-row-left">
        <span class="search-row-rank">#${s.scopeRank}</span>
        <div class="search-row-details">
          <div class="search-row-name">${escapeHtml(s.name || 'Unknown')}</div>
          <div class="search-row-meta">
            <span class="search-row-roll">${escapeHtml(s.rollNo || '-')}</span>
            <span class="search-row-pill ${branchClass}">${escapeHtml(s.branch || '-')}</span>
            ${groupText ? `<span class="search-row-sec">&bull; ${escapeHtml(groupText)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="search-row-right">
        <span class="search-row-pts">${scoreVal}</span>
        <span class="search-row-unit">pts</span>
      </div>
    `;

    searchDropdownList.appendChild(row);
  });
}

// ==========================================
// Render Podium (Exact 1st, 2nd, 3rd — ALWAYS STILL & UNCHANGED)
// ==========================================
function renderPodium(top3) {
  podiumContainer.innerHTML = '';
  
  if (!top3 || top3.length < 3) {
    document.getElementById('podiumSection').style.display = 'none';
    return;
  }
  document.getElementById('podiumSection').style.display = 'block';

  const maxPossible = isExcludeA1 ? 1000 : 1500;
  const ranks = ['1', '2', '3'];
  const rankLabels = ['1st Place', '2nd Place', '3rd Place'];

  // Top 3 positions remain permanently still, never altered or shifted by search
  top3.forEach((s, idx) => {
    const card = document.createElement('div');
    card.className = `podium-card rank-${ranks[idx]}`;
    card.onclick = () => openStudentModal(s);

    const totalA = s.effectiveAssessment || 0;
    const pct = ((totalA / maxPossible) * 100).toFixed(1);
    const a1 = s.assessment1_num || 0;
    const a2 = s.assessment2_num || 0;
    const a3 = s.assessment3_num || 0;

    const a1Display = isExcludeA1 ? `<span class="score-excluded">${a1}</span>` : `${a1}`;

    card.innerHTML = `
      <div class="podium-top">
        <span class="podium-rank-tag">#${ranks[idx]} ${rankLabels[idx]}</span>
        <span class="podium-branch-tag">${escapeHtml(s.branch || '-')}</span>
      </div>
      <div>
        <h4 class="podium-name">${escapeHtml(s.name || 'Unknown')}</h4>
        <div class="podium-roll font-mono">${escapeHtml(s.rollNo || '-')}</div>
      </div>
      <div class="podium-metrics">
        <div>
          <div class="podium-stat-val">${totalA} <span style="font-size: 13px; font-weight: 500; color: var(--ink-secondary);">/ ${maxPossible}</span></div>
          <div class="podium-stat-lbl">${isExcludeA1 ? 'Total (A2+A3)' : 'Total Marks'} (${pct}%)</div>
        </div>
        <div style="text-align: right;">
          <div class="podium-stat-val" style="font-size: 13px; color: var(--ink-primary); font-weight: 500;">
            ${a1Display} | ${a2} | ${a3}
          </div>
          <div class="podium-stat-lbl">A1 | A2 | A3</div>
        </div>
      </div>
    `;

    podiumContainer.appendChild(card);
  });
}

// ==========================================
// Render Table & Pagination
// ==========================================
function renderTable() {
  rankingBody.innerHTML = '';

  const maxPossible = isExcludeA1 ? 1000 : 1500;

  // Dynamically update column headers
  const thA1 = document.querySelector('th[data-sort="assessment1_num"]');
  if (thA1) {
    thA1.textContent = isExcludeA1 ? 'A1 (EXCLUDED)' : 'ASSESSMENT 1';
    thA1.style.opacity = isExcludeA1 ? '0.45' : '1';
  }
  const thTotal = document.querySelector('th[data-sort="total_assessment"]');
  if (thTotal) {
    thTotal.textContent = isExcludeA1 ? 'TOTAL MARKS (/1000)' : 'TOTAL MARKS (/1500)';
  }

  const total = filteredStudents.length;
  if (total === 0) {
    rankingBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 48px; color: var(--ink-muted);">
          No students found matching your criteria.
        </td>
      </tr>
    `;
    pageInfo.textContent = 'Showing 0 of 0';
    prevPageBtn.disabled = true;
    nextPageBtn.disabled = true;
    return;
  }

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, total);
  const pageStudents = filteredStudents.slice(startIdx, endIdx);

  pageStudents.forEach((s) => {
    // True persistent rank across the cohort/branch!
    const rank = s.scopeRank || (startIdx + 1);
    const tr = document.createElement('tr');

    // Rank Pill
    let rankClass = 'rank-pill';
    if (rank === 1) rankClass += ' rank-top-1';
    else if (rank === 2) rankClass += ' rank-top-2';
    else if (rank === 3) rankClass += ' rank-top-3';

    // Assessment total & progress bar
    const totalA = s.effectiveAssessment || 0;
    const pct = ((totalA / maxPossible) * 100).toFixed(1);
    const barWidth = Math.min(Math.max((totalA / maxPossible) * 100, 0), 100);

    // Individual assessments
    const a1Str = (s.assessment1 && s.assessment1 !== '-') ? escapeHtml(s.assessment1) : '-';
    const a2Str = (s.assessment2 && s.assessment2 !== '-') ? escapeHtml(s.assessment2) : '-';
    const a3Str = (s.assessment3 && s.assessment3 !== '-') ? escapeHtml(s.assessment3) : '-';

    const a1CellHtml = isExcludeA1 
      ? `<span class="score-excluded" title="Assessment 1 Excluded">${a1Str}</span>` 
      : a1Str;

    // Branch and Group Ranks
    const branchRankStr = s.branchRank ? `#${s.branchRank}` : '-';
    const groupRankStr = s.groupRank ? `#${s.groupRank}` : '-';
    const isTopBranch = s.branchRank === 1 ? ' top-1' : '';
    const isTopGroup = s.groupRank === 1 ? ' top-1' : '';

    tr.className = 'ranking-row';
    tr.onclick = () => handleStudentClick(s.rollNo);

    // Group short form
    let groupShort = s.resolvedGroup || s.cycle1 || s.cycle2 || '-';
    if (groupShort.includes('Section ')) {
      groupShort = groupShort.replace('Section ', '').trim();
    }

    tr.innerHTML = `
      <td class="col-rank">
        <span class="${rankClass}">#${rank}</span>
      </td>
      <td class="col-student">
        <div class="student-name-row">
          <span class="student-name-link">
            ${escapeHtml(s.name || 'Unknown')}
          </span>
          <span class="mobile-branch-pill">${escapeHtml(s.branch || '-')}</span>
        </div>
        <div class="student-roll font-mono">${escapeHtml(s.rollNo || '-')}</div>
      </td>
      <!-- Mobile-only full-width details row (starts directly below rank and extends to end) -->
      <td class="col-mobile-details">
        <div class="mobile-details-box">
          <div class="mob-meta-row font-mono">
            <span class="mob-stat-item">Grp: <strong>${escapeHtml(groupShort)}</strong></span>
            <span class="mob-stat-sep">•</span>
            <span class="mob-stat-item highlight-tot">Tot: <strong>${totalA}</strong><span class="mob-tot-max">/${maxPossible}</span></span>
            <span class="mob-stat-sep">•</span>
            <span class="mob-stat-item">BRank: <strong>${branchRankStr}</strong></span>
            <span class="mob-stat-sep">•</span>
            <span class="mob-stat-item">GRank: <strong>${groupRankStr}</strong></span>
          </div>
          <div class="mob-scores-row font-mono">
            <span class="mob-score-val">A1: ${isExcludeA1 ? '<span class="score-excluded">' + a1Str + '</span>' : a1Str}</span>
            <span class="mob-score-sep">|</span>
            <span class="mob-score-val">A2: ${a2Str}</span>
            <span class="mob-score-sep">|</span>
            <span class="mob-score-val">A3: ${a3Str}</span>
          </div>
        </div>
      </td>
      <td class="col-branch">
        <span class="badge-branch">${escapeHtml(s.branch || '-')}</span>
      </td>
      <td class="col-group">
        <span class="badge-group">${escapeHtml(s.resolvedGroup || s.cycle1 || s.cycle2 || '-')}</span>
      </td>
      <td class="col-assessment">
        <div class="assessment-main-cell">
          <span class="assessment-total-val">${totalA} <span style="font-size: 11px; color: var(--ink-secondary); font-weight: normal;">/ ${maxPossible}</span></span>
          <div class="assessment-total-sub">
            <div class="assessment-bar-track" title="${pct}%">
              <div class="assessment-bar-fill" style="width: ${barWidth}%;"></div>
            </div>
            <span class="assessment-pct">${pct}%</span>
          </div>
        </div>
      </td>
      <td class="col-a1 font-mono">
        ${a1CellHtml}
      </td>
      <td class="col-a2 font-mono">
        ${a2Str}
      </td>
      <td class="col-a3 font-mono">
        ${a3Str}
      </td>
      <td class="col-branch-rank font-mono">
        <span class="rank-sub-badge${isTopBranch}" title="Rank #${s.branchRank} of ${s.branchTotal || '-'} in ${escapeHtml(s.branch || '')}">${branchRankStr}</span>
      </td>
      <td class="col-group-rank font-mono">
        <span class="rank-sub-badge${isTopGroup}" title="Rank #${s.groupRank} of ${s.groupTotal || '-'} in ${escapeHtml(s.resolvedGroup || '')}">${groupRankStr}</span>
      </td>
    `;

    rankingBody.appendChild(tr);
  });

  // Update pagination controls
  pageInfo.textContent = `Showing ${startIdx + 1} - ${endIdx} of ${total}`;
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = endIdx >= total;
}

function renderProfileIcon(url, typeClass, label, title) {
  if (hasValidUrl(url)) {
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="profile-icon-link ${typeClass}" title="${title}: ${escapeHtml(url)}">${label}</a>`;
  }
  return `<span class="profile-icon-link" style="opacity: 0.25; cursor: default;" title="No ${title} link">-</span>`;
}

// ==========================================
// Modal Operations
// ==========================================
window.handleStudentClick = function(rollNo) {
  const student = allStudents.find(s => s.rollNo === rollNo);
  if (student) {
    openStudentModal(student);
  }
};

function openStudentModal(s) {
  currentModalStudent = s;

  // Header info
  document.getElementById('modalStudentName').textContent = s.name || 'STUDENT REPORT';
  document.getElementById('modalStudentRoll').textContent = `Roll No: ${s.rollNo || '-'}`;
  
  const mBranchPill = document.getElementById('mHeaderBranch');
  if (mBranchPill) mBranchPill.textContent = s.branch || '-';
  
  const mGroupPill = document.getElementById('mHeaderGroup');
  if (mGroupPill) mGroupPill.textContent = s.resolvedGroup || s.cycle1 || s.cycle2 || 'Training Section';

  // Hero total score card
  const maxPossible = isExcludeA1 ? 1000 : 1500;
  const totalScore = s.effectiveAssessment || 0;
  const pct = ((totalScore / maxPossible) * 100).toFixed(1);
  const barWidth = Math.min(Math.max((totalScore / maxPossible) * 100, 0), 100);

  const mHeroLabel = document.getElementById('mHeroTotalLabel');
  if (mHeroLabel) {
    mHeroLabel.textContent = isExcludeA1 ? 'TOTAL SCORE (EXCLUDING A1)' : 'TOTAL ASSESSMENT SCORE';
  }

  const mTotalVal = document.getElementById('mTotalScoreVal');
  if (mTotalVal) mTotalVal.textContent = totalScore;

  const mTotalMax = document.getElementById('mTotalScoreMax');
  if (mTotalMax) mTotalMax.textContent = `/ ${maxPossible}`;

  const mTotalPct = document.getElementById('mTotalScorePct');
  if (mTotalPct) mTotalPct.textContent = `${pct}%`;

  const mTotalBar = document.getElementById('mTotalScoreBar');
  if (mTotalBar) mTotalBar.style.width = `${barWidth}%`;

  // Assessment cards (A1, A2, A3)
  const a1Card = document.getElementById('mA1Card');
  if (a1Card) a1Card.classList.toggle('is-excluded', isExcludeA1);

  const a1Val = document.getElementById('mA1Val');
  if (a1Val) a1Val.textContent = (s.assessment1 && s.assessment1 !== '-') ? s.assessment1 : '-';

  const a1Sub = document.getElementById('mA1Sub');
  if (a1Sub) a1Sub.textContent = isExcludeA1 ? 'EXCLUDED' : 'Max: 500';

  const a2Val = document.getElementById('mA2Val');
  if (a2Val) a2Val.textContent = (s.assessment2 && s.assessment2 !== '-') ? s.assessment2 : '-';

  const a3Val = document.getElementById('mA3Val');
  if (a3Val) a3Val.textContent = (s.assessment3 && s.assessment3 !== '-') ? s.assessment3 : '-';

  // Cohort rank cards
  const mOverallRank = document.getElementById('mOverallRankVal');
  if (mOverallRank) mOverallRank.textContent = s.overallRank ? `#${s.overallRank}` : '-';

  const mBranchRank = document.getElementById('mBranchRankVal');
  if (mBranchRank) mBranchRank.textContent = s.branchRank ? `#${s.branchRank}` : '-';

  const mBranchSub = document.getElementById('mBranchRankSub');
  if (mBranchSub) mBranchSub.textContent = `in ${s.branch || 'Branch'}`;

  const mGroupRank = document.getElementById('mGroupRankVal');
  if (mGroupRank) mGroupRank.textContent = s.groupRank ? `#${s.groupRank}` : '-';

  const mGroupSub = document.getElementById('mGroupRankSub');
  if (mGroupSub) mGroupSub.textContent = `in ${s.resolvedGroup || 'Group'}`;

  // Performance stats
  const mCP = document.getElementById('mCP');
  if (mCP) mCP.textContent = s.cpScore ? (s.cpScore.includes('%') ? s.cpScore : `${s.cpScore}%`) : '-';

  const mComm = document.getElementById('mComm');
  if (mComm) mComm.textContent = s.communicationScore ? (s.communicationScore.includes('%') ? s.communicationScore : `${s.communicationScore}%`) : '-';

  const mStatus = document.getElementById('mStatus');
  if (mStatus) mStatus.textContent = s.status || 'Active';

  // Coding profiles
  const profilesList = document.getElementById('modalProfilesList');
  if (profilesList) {
    profilesList.innerHTML = '';
    if (hasValidUrl(s.assessment4)) {
      profilesList.innerHTML += `<a href="${escapeHtml(s.assessment4)}" target="_blank" class="profile-link-btn" style="color: #FFA116;">LeetCode Profile &nearr;</a>`;
    }
    if (hasValidUrl(s.assessment5)) {
      profilesList.innerHTML += `<a href="${escapeHtml(s.assessment5)}" target="_blank" class="profile-link-btn" style="color: #3B82F6;">Codeforces Profile &nearr;</a>`;
    }
    if (hasValidUrl(s.assessment6)) {
      profilesList.innerHTML += `<a href="${escapeHtml(s.assessment6)}" target="_blank" class="profile-link-btn" style="color: #8B5CF6;">CodeChef Profile &nearr;</a>`;
    }
    if (!profilesList.innerHTML) {
      profilesList.innerHTML = '<span style="color: var(--ink-muted); font-size: 13px;">No coding profile links attached.</span>';
    }
  }

  // Footer Note
  const footerNote = document.getElementById('mFooterNote');
  if (footerNote) {
    footerNote.innerHTML = 'Made by student &bull; For mismatched data contact Instagram: <a href="https://instagram.com/hey.admindkkk" target="_blank" rel="noopener noreferrer" class="insta-link-badge">@hey.admindkkk</a>';
  }

  reportModal.style.display = 'flex';
}

function closeStudentModal() {
  reportModal.style.display = 'none';
  currentModalStudent = null;
}



// ==========================================
// Event Listeners
// ==========================================
// EXCLUDE A1 Toggle Button
if (excludeA1Btn) {
  excludeA1Btn.onclick = () => {
    isExcludeA1 = !isExcludeA1;
    excludeA1Btn.classList.toggle('active', isExcludeA1);
    if (excludeA1State) {
      excludeA1State.textContent = isExcludeA1 ? 'ON' : 'OFF';
    }
    calculateAllRanks();
    updateBatchMetrics(allStudents);
    applyFiltersAndSort();
    if (currentModalStudent) {
      openStudentModal(currentModalStudent);
    }
  };
  excludeA1Btn.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      excludeA1Btn.click();
    }
  };
}

// Search
searchInput.oninput = () => {
  clearSearchBtn.style.display = searchInput.value ? 'block' : 'none';
  applyFiltersAndSort();
};

clearSearchBtn.onclick = () => {
  searchInput.value = '';
  clearSearchBtn.style.display = 'none';
  applyFiltersAndSort();
};

// Branch buttons filter
const branchFilterContainer = document.getElementById('branchFilter');
if (branchFilterContainer) {
  branchFilterContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    branchFilterContainer.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentBranch = btn.dataset.branch;
    applyFiltersAndSort();
  });
}

// Group filter
groupFilter.onchange = () => {
  currentGroup = groupFilter.value;
  applyFiltersAndSort();
};

// Sort selection
sortBySelect.onchange = () => {
  currentSortKey = sortBySelect.value;
  applyFiltersAndSort();
};

// Table column header click to sort
document.querySelectorAll('.ranking-table th.sortable').forEach(th => {
  th.onclick = () => {
    const key = th.dataset.sort;
    if (currentSortKey === key) {
      sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    } else {
      currentSortKey = key;
      sortDirection = 'desc';
      sortBySelect.value = key;
    }
    applyFiltersAndSort();
  };
});

// Pagination
prevPageBtn.onclick = () => {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
    window.scrollTo({ top: 400, behavior: 'smooth' });
  }
};

nextPageBtn.onclick = () => {
  if (currentPage * PAGE_SIZE < filteredStudents.length) {
    currentPage++;
    renderTable();
    window.scrollTo({ top: 400, behavior: 'smooth' });
  }
};

// Modal and Dropdown close
modalCloseBtn.onclick = closeStudentModal;

function handleOutsideClick(e) {
  if (e.target === reportModal) closeStudentModal();
  if (searchDropdown && searchDropdown.style.display !== 'none' && !e.target.closest('.search-wrapper')) {
    searchDropdown.style.display = 'none';
  }
}

window.addEventListener('click', handleOutsideClick);
window.addEventListener('touchstart', (e) => {
  if (searchDropdown && searchDropdown.style.display !== 'none' && !e.target.closest('.search-wrapper')) {
    searchDropdown.style.display = 'none';
  }
}, { passive: true });

window.onkeydown = (e) => {
  if (e.key === 'Escape') {
    closeStudentModal();
    if (searchDropdown) {
      searchDropdown.style.display = 'none';
    }
  }
};

searchInput.addEventListener('focus', () => {
  if (searchInput.value.trim() && filteredStudents && filteredStudents.length > 0) {
    if (searchDropdown) searchDropdown.style.display = 'block';
  }
});

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Start application
init();
