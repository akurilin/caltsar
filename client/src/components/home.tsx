import { baseAPIURL } from "../api";
import { Button, Result } from "antd";
import { CalendarOutlined } from "@ant-design/icons";
import { User } from "../models/models";
import { Redirect } from "react-router-dom";
import { useState } from "react";

export default function Home(props: { user: User | null }): JSX.Element {
  const [loading, setLoading] = useState(false);

  const url = `${baseAPIURL}/auth/google`;

  const onClick = () => {
    setLoading(true);
  };

  const button = loading ? (
    <Button type="primary" href={url} loading>
      {" "}
      Google Login{" "}
    </Button>
  ) : (
    <Button type="primary" href={url} onClick={onClick}>
      Google Login
    </Button>
  );

  const content = props.user ? (
    <Redirect to="/sync" />
  ) : (
    <Result
      icon={<CalendarOutlined />}
      title="CalTsar"
      subTitle="Accountability for your meetings"
      extra={button}
    />
  );
  return content;
}
