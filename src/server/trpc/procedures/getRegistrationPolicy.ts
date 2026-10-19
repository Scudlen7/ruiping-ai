import { baseProcedure } from "~/server/trpc/main";
import { isOpenRegistration } from "~/server/services/registration";

export const getRegistrationPolicy = baseProcedure.query(() => ({
  teacherInvitationCodeRequired: !isOpenRegistration(),
}));
