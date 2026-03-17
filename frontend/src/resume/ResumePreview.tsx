import { memo } from "react";
import type { JobSeekerProfile, ResumeSettings, ResumeTemplate } from "../types";
import { AtsModernTemplate } from "./templates/AtsModernTemplate";
import { ProfessionalTemplate } from "./templates/ProfessionalTemplate";
import { SingleColumnTemplate } from "./templates/SingleColumnTemplate";
import { CreativeCardTemplate } from "./templates/CreativeCardTemplate";
import { EditorialSidebarTemplate, FormalCenteredTemplate, PastelProfileTemplate } from "./templates/ShowcaseTemplates";

function resolveSingleColumnVariant(template: ResumeTemplate): "ATS_PLAIN" | "TECH_FOCUSED" | "EXECUTIVE" | "STARTUP" | "ACADEMIC" {
  if (template === "EXECUTIVE") return "EXECUTIVE";
  if (template === "STARTUP" || template === "PRODUCT_MANAGER") return "STARTUP";
  if (template === "ACADEMIC" || template === "DATA_SCIENTIST" || template === "DATA_ANALYST") return "ACADEMIC";
  if (
    template === "TECH_FOCUSED"
    || template === "FRONTEND_ENGINEER"
    || template === "BACKEND_ENGINEER"
    || template === "FULL_STACK_ENGINEER"
    || template === "DEVOPS_ENGINEER"
    || template === "QA_AUTOMATION_ENGINEER"
    || template === "MOBILE_DEVELOPER"
    || template === "CYBERSECURITY_ANALYST"
  ) {
    return "TECH_FOCUSED";
  }
  return "ATS_PLAIN";
}

export const ResumePreview = memo(function ResumePreview(props: { profile: JobSeekerProfile; template: ResumeTemplate; settings: ResumeSettings }) {
  if (props.template === "EDITORIAL_SIDEBAR") {
    return <EditorialSidebarTemplate profile={props.profile} settings={props.settings} />;
  }
  if (props.template === "FORMAL_CENTERED") {
    return <FormalCenteredTemplate profile={props.profile} settings={props.settings} />;
  }
  if (props.template === "PASTEL_PROFILE") {
    return <PastelProfileTemplate profile={props.profile} settings={props.settings} />;
  }
  if (props.template === "CLASSIC") {
    return <ProfessionalTemplate profile={props.profile} settings={props.settings} />;
  }
  if (props.template === "MINIMAL" || props.template === "UI_UX_DESIGNER") {
    return <CreativeCardTemplate profile={props.profile} settings={props.settings} />;
  }
  if (props.template === "MODERN") {
    return <AtsModernTemplate profile={props.profile} settings={props.settings} />;
  }
  if (props.template === "MARKETING_SPECIALIST") {
    return <ProfessionalTemplate profile={props.profile} settings={props.settings} />;
  }
  return <SingleColumnTemplate profile={props.profile} settings={props.settings} variant={resolveSingleColumnVariant(props.template)} />;
});
