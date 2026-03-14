import React from "react";
import { Badge } from "antd";
import { APIEvent } from "../models/models";

interface Props {
  instance: APIEvent;
  parentFn: (a: APIEvent) => void;
}

export function CalendarInstance(props: Props): JSX.Element {
  const status = props.instance.tracked ? "success" : "default";

  return (
    <li onClick={() => props.parentFn(props.instance)}>
      <Badge status={status} text={props.instance.summary} />
    </li>
  );
}
