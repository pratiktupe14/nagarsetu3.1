# NAGARSETU 3.1 — SUPERVISORLLM MASTER PROMPT & QUALITY GATE SPECIFICATION

## 1. PURPOSE
This document specifies the rules, checks, and evidence requirements for the SupervisorLLM Quality Gate during the NAGARSETU 3.1 architectural evolution.

---

## 2. MANDATORY VERIFICATION WORKFLOW
For every iteration, the Supervisor agent MUST perform:
1. **REQUIREMENT & SCOPE CHECK**: Verify task bounds to prevent big-bang refactoring.
2. **GIT SAFETY CHECK**: Verify `git status` and ensure uncommitted changes are understood.
3. **SECURITY AUDIT**: Verify Fail-Closed canonical department resolution (`isDeptMatch`), IDOR protection, and role isolation.
4. **TEST EXECUTION**: Execute Node.js test runner suites in `tests/`.
5. **TYPESCRIPT CHECK**: Execute `npx tsc --noEmit` in `frontend/`.
6. **BUILD CHECK**: Execute `npm run build` in `frontend/`.
7. **EVIDENCE REPORTING**: Output exact command outputs, exit codes, and evidence logs. Never report PASS without current command evidence.
