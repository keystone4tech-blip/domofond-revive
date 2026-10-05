// src/data/fsmInstructionsData.ts
// Мостик обратной совместимости: реэкспорт официальной базы знаний CRM
export {
  CRM_INSTRUCTIONS,
  CRM_INSTRUCTIONS as FSM_INSTRUCTIONS,
  getInstructionByTabId
} from "./crmInstructionsData";

export type {
  CRMSectionInstruction,
  CRMSectionInstruction as FSMSectionInstruction,
  InstructionScenario,
  InstructionStep
} from "./crmInstructionsData";
