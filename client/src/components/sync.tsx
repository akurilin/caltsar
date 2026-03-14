// import { baseAPIURL } from "../api";
import { Result } from "antd";
import { SyncOutlined } from "@ant-design/icons";
// import { User } from "../models/models";
// import { Redirect } from "react-router-dom";
import { useEffect, useState } from "react";
import { baseAPIURL } from "../api";
import axios from "axios";
import { Redirect } from "react-router-dom";

export default function Sync(): JSX.Element {
  // we begin in the syncing state and when we're done it's time to
  // redirect to the next page
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    const asyncFn = async () => {
      try {
        await axios.post(
          `${baseAPIURL}/sync`,
          {},
          {
            withCredentials: true,
          }
        );
        setSyncing(false);
      } catch (e) {
        console.log(e);
      }
    };

    asyncFn();
  }, []);

  return (
    <>
      {syncing && (
        <Result
          icon={<SyncOutlined spin />}
          title="CalTsar is currently syncing with your calendar"
        />
      )}
      {!syncing && <Redirect to="/calendar" />}
    </>
  );
}
