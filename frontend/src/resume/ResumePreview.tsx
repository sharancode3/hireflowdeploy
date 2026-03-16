import { memo } from "react";
import type { JobSeekerProfile, ResumeSettings, ResumeTemplate } from "../types";
import { AtsModernTemplate } from "./templates/AtsModernTemplate";
import { ProfessionalTemplate } from "./templates/ProfessionalTemplate";
import { SingleColumnTemplate } from "./templates/SingleColumnTemplate";
import { CreativeCardTemplate } from "./templates/CreativeCardTemplate";

export const ResumePreview = memo(function ResumePreview(props: { profile: JobSeekerProfile; template: ResumeTemplate; settings: ResumeSettings }) {
  if (props.template === "ATS_PLAIN") {
    return <SingleColumnTemplate profile={props.profile} settings={props.settings} variant="ATS_PLAIN" />;
  }
  if (props.template === "TECH_FOCUSED") {
    return <SingleColumnTemplate profile={props.profile} settings={props.settings} variant="TECH_FOCUSED" />;
  }
  if (props.template === "EXECUTIVE") {
    return <SingleColumnTemplate profile={props.profile} settings={props.settings} variant="EXECUTIVE" />;
  }
  if (props.template === "STARTUP") {
    return <SingleColumnTemplate profile={props.profile} settings={props.settings} variant="STARTUP" />;
  }
  if (props.template === "ACADEMIC") {
    return <SingleColumnTemplate profile={props.profile} settings={props.settings} variant="ACADEMIC" />;
  }
  if (props.template === "CLASSIC") {
    return <ProfessionalTemplate profile={props.profile} settings={props.settings} />;
  }
  if (props.template === "MINIMAL") {
    return <CreativeCardTemplate profile={props.profile} settings={props.settings} />;
  }
  return <AtsModernTemplate profile={props.profile} settings={props.settings} />;
});
