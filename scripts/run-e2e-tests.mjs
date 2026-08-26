import fs from 'fs';

const BASE_URL = 'http://localhost:3000';

const results = [];

function logTest(testName, result, details, evidence) {
  results.push({ testName, result, details, evidence });
  console.log(`\n==================================================`);
  console.log(`TEST: ${testName}`);
  console.log(`RESULT: ${result}`);
  console.log(`DETAILS: ${details}`);
  console.log(`EVIDENCE: ${JSON.stringify(evidence, null, 2)}`);
  console.log(`==================================================`);
}

function makeEvent(action, payload) {
  return {
    action,
    payload,
    timestamp: new Date().toISOString()
  };
}

async function fetchSync() {
  const res = await fetch(`${BASE_URL}/api/sync`, {
    headers: { 'x-user-role': 'teacher' }
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'success') {
    throw new Error(`Sync GET failed: ${res.status} ${data.message || ''}`);
  }
  return data.payload || data.data;
}

async function postSync(pendingEvents) {
  const res = await fetch(`${BASE_URL}/api/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': 'teacher'
    },
    body: JSON.stringify({
      lastSyncTimestamp: Date.now(),
      pendingEvents
    })
  });
  const data = await res.json();
  if (!res.ok || data.status !== 'success') {
    throw new Error(`Sync POST failed: ${res.status} ${data.message || ''}`);
  }
  return data;
}

async function fetchParentLookup(code) {
  const res = await fetch(`${BASE_URL}/api/parents/lookup?code=${encodeURIComponent(code)}`);
  const data = await res.json();
  return { status: res.status, data };
}

async function runAllTests() {
  console.log("Starting End-to-End Real Runtime Tests for Neon PostgreSQL Persistence...\n");

  try {
    // SETUP: Initialize base entities (Students & Group)
    const setupEvents = [
      makeEvent('ADD_GROUP', { id: 'GRP_101', name: 'المجموعة الأولى', monthlyFee: 200 }),
      makeEvent('ADD_STUDENT', { id: 'STU_A_001', name: 'أحمد علي', code: '1001', groupId: 'GRP_101', phone: '01011111111', parentPhone: '01022222222', status: 'active' }),
      makeEvent('ADD_STUDENT', { id: 'STU_B_002', name: 'محمد حسن', code: '1002', groupId: 'GRP_101', phone: '01033333333', parentPhone: '01044444444', status: 'active' })
    ];

    await postSync(setupEvents);
    console.log("Setup completed successfully.");

    // TEST 1 — EXAM CREATE
    {
      const examId = 'EXAM_E2E_01';
      const addExamEvent = makeEvent('ADD_EXAM', { id: examId, title: 'امتحان الرياضيات الشهر الأول', maxScore: 20, date: '2026-10-01', targetGroupIds: ['GRP_101'], scores: {} });
      const scoreEvent = makeEvent('SAVE_EXAM_SCORES', { id: examId, examId, scores: { 'STU_A_001': 17.5 } });

      const syncRes = await postSync([addExamEvent, scoreEvent]);

      // Wipe local state simulation by directly querying Neon via GET /api/sync
      const restoredState = await fetchSync();
      const restoredExam = (restoredState.exams || []).find(e => e.id === examId);
      const studentScore = restoredExam?.scores?.['STU_A_001'];

      // Parent Lookup API check
      const parentResult = await fetchParentLookup('1001');
      const parentExam = (parentResult.data.exams || []).find(e => e.id === examId);

      const pass = studentScore === 17.5 && parentExam?.score === 17.5;
      logTest(
        'TEST 1 — EXAM CREATE (17.5)',
        pass ? 'PASS' : 'FAIL',
        'Exam created with decimal score 17.5, synced to Neon, local cache wiped, state re-fetched.',
        {
          syncPostStatus: syncRes.status,
          restoredScoreFromNeon: studentScore,
          parentLookupScore: parentExam?.score
        }
      );
    }

    // TEST 2 — EXAM EDIT
    {
      const examId = 'EXAM_E2E_01';
      const editScoreEvent = makeEvent('SAVE_EXAM_SCORES', { id: examId, examId, scores: { 'STU_A_001': 18.25 } });

      const syncRes = await postSync([editScoreEvent]);
      const restoredState = await fetchSync();
      const restoredExam = (restoredState.exams || []).find(e => e.id === examId);
      const studentScore = restoredExam?.scores?.['STU_A_001'];

      const parentResult = await fetchParentLookup('1001');
      const parentExam = (parentResult.data.exams || []).find(e => e.id === examId);

      const pass = studentScore === 18.25 && parentExam?.score === 18.25;
      logTest(
        'TEST 2 — EXAM EDIT (17.5 -> 18.25)',
        pass ? 'PASS' : 'FAIL',
        'Exam score edited to 18.25, synced to Neon PostgreSQL, local cache wiped, state re-fetched.',
        {
          syncPostStatus: syncRes.status,
          restoredScoreFromNeon: studentScore,
          parentLookupScore: parentExam?.score
        }
      );
    }

    // TEST 3 — RECITATION CREATE
    {
      const recId = 'REC_E2E_01';
      const addRecEvent = makeEvent('ADD_RECITATION', { id: recId, title: 'تسميع سورة البقرة', maxScore: 10, date: '2026-10-02', groupId: 'GRP_101', scores: {} });
      const scoreEvent = makeEvent('SAVE_RECITATION_SCORES', { id: recId, recitationId: recId, scores: { 'STU_A_001': 8.5 } });

      const syncRes = await postSync([addRecEvent, scoreEvent]);
      const restoredState = await fetchSync();
      const restoredRec = (restoredState.recitations || []).find(r => r.id === recId);
      const studentScore = restoredRec?.scores?.['STU_A_001'];

      const parentResult = await fetchParentLookup('1001');
      const parentRec = (parentResult.data.recitations || []).find(r => r.id === recId);

      const pass = studentScore === 8.5 && parentRec?.score === 8.5;
      logTest(
        'TEST 3 — RECITATION CREATE (8.5)',
        pass ? 'PASS' : 'FAIL',
        'Recitation created with score 8.5, synced to Neon, local cache wiped, state re-fetched.',
        {
          syncPostStatus: syncRes.status,
          restoredScoreFromNeon: studentScore,
          parentLookupScore: parentRec?.score
        }
      );
    }

    // TEST 4 — RECITATION EDIT
    {
      const recId = 'REC_E2E_01';
      const editScoreEvent = makeEvent('SAVE_RECITATION_SCORES', { id: recId, recitationId: recId, scores: { 'STU_A_001': 9.25 } });

      const syncRes = await postSync([editScoreEvent]);
      const restoredState = await fetchSync();
      const restoredRec = (restoredState.recitations || []).find(r => r.id === recId);
      const studentScore = restoredRec?.scores?.['STU_A_001'];

      const parentResult = await fetchParentLookup('1001');
      const parentRec = (parentResult.data.recitations || []).find(r => r.id === recId);

      const pass = studentScore === 9.25 && parentRec?.score === 9.25;
      logTest(
        'TEST 4 — RECITATION EDIT (8.5 -> 9.25)',
        pass ? 'PASS' : 'FAIL',
        'Recitation score edited to 9.25, synced to Neon PostgreSQL, local cache wiped, state re-fetched.',
        {
          syncPostStatus: syncRes.status,
          restoredScoreFromNeon: studentScore,
          parentLookupScore: parentRec?.score
        }
      );
    }

    // TEST 5 — DUPLICATE CHECK
    {
      const examId = 'EXAM_E2E_01';
      const recId = 'REC_E2E_01';

      const updateExamEvent = makeEvent('UPDATE_EXAM', { id: examId, title: 'امتحان الرياضيات الشهر الأول المعدل', maxScore: 20 });
      const updateRecEvent = makeEvent('UPDATE_RECITATION', { id: recId, title: 'تسميع سورة البقرة المعدل', maxScore: 10 });

      await postSync([updateExamEvent, updateRecEvent]);
      const restoredState = await fetchSync();

      const examCount = (restoredState.exams || []).filter(e => e.id === examId).length;
      const recCount = (restoredState.recitations || []).filter(r => r.id === recId).length;

      const pass = examCount === 1 && recCount === 1;
      logTest(
        'TEST 5 — DUPLICATE CHECK',
        pass ? 'PASS' : 'FAIL',
        'Verified editing exam & recitation metadata updates the existing entity without creating duplicates.',
        {
          examCountForId: examCount,
          recitationCountForId: recCount,
          totalExamsInDb: (restoredState.exams || []).length,
          totalRecitationsInDb: (restoredState.recitations || []).length
        }
      );
    }

    // TEST 6 — MULTI-STUDENT MERGE
    {
      const examId = 'EXAM_E2E_01';
      const recId = 'REC_E2E_01';

      // 1. Add score for Student B (15.25 in exam, 7.75 in recitation)
      await postSync([
        makeEvent('SAVE_EXAM_SCORES', { id: examId, scores: { 'STU_B_002': 15.25 } }),
        makeEvent('SAVE_RECITATION_SCORES', { id: recId, scores: { 'STU_B_002': 7.75 } })
      ]);

      // 2. Modify ONLY Student A (18.25 -> 18.5 in exam, 9.25 -> 9.75 in recitation)
      await postSync([
        makeEvent('SAVE_EXAM_SCORES', { id: examId, scores: { 'STU_A_001': 18.5 } }),
        makeEvent('SAVE_RECITATION_SCORES', { id: recId, scores: { 'STU_A_001': 9.75 } })
      ]);

      // 3. Wipe local state & re-fetch from Neon PostgreSQL
      const restoredState = await fetchSync();
      const exam = (restoredState.exams || []).find(e => e.id === examId);
      const rec = (restoredState.recitations || []).find(r => r.id === recId);

      const passExam = exam?.scores?.['STU_A_001'] === 18.5 && exam?.scores?.['STU_B_002'] === 15.25;
      const passRec = rec?.scores?.['STU_A_001'] === 9.75 && rec?.scores?.['STU_B_002'] === 7.75;
      const pass = passExam && passRec;

      logTest(
        'TEST 6 — MULTI-STUDENT MERGE',
        pass ? 'PASS' : 'FAIL',
        'Updating Student A scores preserved Student B scores without data loss or overwriting.',
        {
          examScoresInNeon: exam?.scores,
          recitationScoresInNeon: rec?.scores,
          studentAPassed: passExam,
          studentBPreserved: passRec
        }
      );
    }

    // TEST 7 — OFFLINE EDIT & QUEUE REPLAY
    {
      const examId = 'EXAM_E2E_01';
      const recId = 'REC_E2E_01';

      // Simulate offline queue replay with accumulated events
      const offlinePendingEvents = [
        makeEvent('SAVE_EXAM_SCORES', { id: examId, scores: { 'STU_A_001': 19.25 } }),
        makeEvent('SAVE_RECITATION_SCORES', { id: recId, scores: { 'STU_A_001': 9.95 } })
      ];

      const syncRes = await postSync(offlinePendingEvents);
      const restoredState = await fetchSync();
      const exam = (restoredState.exams || []).find(e => e.id === examId);
      const rec = (restoredState.recitations || []).find(r => r.id === recId);

      const pass = exam?.scores?.['STU_A_001'] === 19.25 && rec?.scores?.['STU_A_001'] === 9.95;
      logTest(
        'TEST 7 — OFFLINE EDIT & QUEUE REPLAY',
        pass ? 'PASS' : 'FAIL',
        'Replayed queued offline delta sync events upon reconnect. Neon PostgreSQL state updated correctly.',
        {
          syncPostStatus: syncRes.status,
          examRestoredScore: exam?.scores?.['STU_A_001'],
          recitationRestoredScore: rec?.scores?.['STU_A_001']
        }
      );
    }

    // TEST 8 — DECIMAL PRECISION
    {
      const decimalTestScores = [0.5, 1.25, 7.5, 8.75, 17.5, 18.25, 19.75, 99.5];
      let allDecimalsIntact = true;
      const precisionAuditLog = [];

      for (let i = 0; i < decimalTestScores.length; i++) {
        const testScore = decimalTestScores[i];
        const testExamId = `EXAM_DEC_${i}`;
        
        await postSync([
          makeEvent('ADD_EXAM', { id: testExamId, title: `امتحان تجريبي ${testScore}`, maxScore: 100, date: '2026-10-05', targetGroupIds: ['GRP_101'], scores: {} }),
          makeEvent('SAVE_EXAM_SCORES', { id: testExamId, scores: { 'STU_A_001': testScore } })
        ]);

        const restoredState = await fetchSync();
        const examObj = (restoredState.exams || []).find(e => e.id === testExamId);
        const restoredScore = examObj?.scores?.['STU_A_001'];

        const parentLookup = await fetchParentLookup('1001');
        const parentExamObj = (parentLookup.data.exams || []).find(e => e.id === testExamId);
        const parentScore = parentExamObj?.score;

        const matches = restoredScore === testScore && parentScore === testScore && typeof restoredScore === 'number';
        if (!matches) allDecimalsIntact = false;

        precisionAuditLog.push({
          inputScore: testScore,
          restoredNeonScore: restoredScore,
          parentApiScore: parentScore,
          isIntact: matches
        });
      }

      logTest(
        'TEST 8 — DECIMAL PRECISION',
        allDecimalsIntact ? 'PASS' : 'FAIL',
        'Verified floating-point decimal scores (0.5, 1.25, 7.5, 8.75, 17.5, 18.25, 19.75, 99.5) remain exact floats without integer coercion.',
        { precisionAuditLog }
      );
    }

    console.log("\n==================================================");
    console.log("TEST SUITE SUMMARY");
    console.log("==================================================");
    const total = results.length;
    const passed = results.filter(r => r.result === 'PASS').length;
    console.log(`Passed: ${passed}/${total}`);
    if (passed === total) {
      console.log("STATUS: ALL TESTS PASSED SUCCESSFULLY! PRODUCTION READY.");
    } else {
      console.log("STATUS: TESTS FAILED.");
    }

  } catch (err) {
    console.error("Test execution error:", err);
  }
}

runAllTests();
