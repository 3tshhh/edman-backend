export enum UserRole {
  VOLUNTEER = 'volunteer',
  ADMIN = 'admin',
  SUB_ADMIN = 'sub_admin',
}

export enum ApplicationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  BANNED = 'banned',
}

export enum VolunteerGroup {
  HARAM = 'الهرم',
  FAISAL = 'فيصل',
}

export enum SessionStatus {
  WAITING_ARRIVAL = 'waiting_arrival',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  LEFT_EARLY = 'left_early',
  ABANDONED = 'abandoned',
}

export enum TaskStatus {
  OPEN = 'open',
  FULL = 'full',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export enum EducationalLevel {
  HIGH_SCHOOL = 'ثانوي',
  BACHELOR = 'بكالوريوس',
  NONE = 'لا يوجد',
}

export enum Governorate {
  CAIRO = 'القاهرة',
  GIZA = 'الجيزة',
  ALEXANDRIA = 'الإسكندرية',
}

export enum Area {
  // Greater Cairo / Giza
  HARAM = 'الهرم',
  FAISAL = 'فيصل',
  DOKKI = 'الدقي',
  MOHANDESSIN = 'المهندسين',
  AGOUZA = 'العجوزة',
}
