import React from "react";
import axios from "axios";
import { APIEvent } from "../models/models";
import { Table, PageHeader } from "antd";

interface State {
  events: APIEvent[];
}

class Events extends React.Component {
  state: State = {
    events: [],
  };

  componentDidMount(): void {
    axios
      .get("http://localhost:3000/events", { withCredentials: true })
      .then((res) => {
        this.setState({ events: res.data });
      })
      .catch((err) => {
        console.log(err);
      });
  }

  render(): React.ReactNode {
    const columns = [
      { title: "Summary", dataIndex: "summary", key: "summary" },
      { title: "Starts At", dataIndex: "startsat", key: "startsat" },
      { title: "Ends At", dataIndex: "endsat", key: "endsat" },
      { title: "Time Zone", dataIndex: "timezone", key: "timezone" },
      { title: "Tracked", dataIndex: "tracked", key: "tracked" },
    ];

    const dataSource = this.state.events.map((e, i) => {
      return {
        key: i,
        summary: e.summary,
        startsat: e.startDateTime,
        endsat: e.endDateTime,
        timezone: e.timeZone,
        tracked: e.tracked.toString(),
      };
    });

    return (
      <>
        <PageHeader
          className="site-page-header"
          backIcon={false}
          title="Recurring Events"
        />
        <Table dataSource={dataSource} columns={columns} />
      </>
    );
  }
}

export default Events;
