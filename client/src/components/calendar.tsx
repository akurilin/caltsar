import React from "react";
import { Calendar, Spin, notification, PageHeader } from "antd";
import { Moment } from "moment";
import * as moment from "moment";
import { APIEvent } from "../models/models";
import { CalendarInstance } from "../components/calendarinstance";
import axios from "axios";
import { baseAPIURL } from "../api";

interface State {
  events: APIEvent[];
  spin: boolean;
}

export default class CalendarContent extends React.Component {
  state: State = {
    events: [],
    spin: false,
  };

  // calendar instances call this when clicked to
  async trackUntrackRecurringEvent(instance: APIEvent): Promise<void> {
    try {
      this.setState({ spin: true });
      if (!instance.tracked) {
        await axios.post(
          `${baseAPIURL}/trackings/${instance.recurringEventGoogleId}`,
          {},
          {
            withCredentials: true,
          }
        );
        const modifiedEvents = this.state.events.map((e) => {
          if (e.recurringEventGoogleId == instance.recurringEventGoogleId) {
            e.tracked = true;
          }
          return e;
        });
        this.setState({ events: modifiedEvents });
        notification.success({
          message: "Recurring Event Tracked",
          description: `Success! You are now tracking "${instance.summary}". Meeting attendees will receive a feedback survey at the end of every event.`,
          duration: 8,
        });
      } else {
        await axios.delete(
          `${baseAPIURL}/trackings/${instance.recurringEventGoogleId}`,
          { withCredentials: true }
        );
        const modifiedEvents = this.state.events.map((e) => {
          if (e.recurringEventGoogleId == instance.recurringEventGoogleId) {
            e.tracked = false;
          }
          return e;
        });
        this.setState({ events: modifiedEvents });

        notification.info({
          message: "Recurring Event Untracked",
          description: `You have stopped tracking "${instance.summary}"`,
          duration: 6,
        });
      }
    } catch (e) {
      console.log(e);
    } finally {
      this.setState({ spin: false });
    }
  }

  async componentDidMount(): Promise<void> {
    try {
      const res = await axios.get(`${baseAPIURL}/events`, {
        withCredentials: true,
      });
      this.setState({ events: res.data });
    } catch (err) {
      console.log(err);
    }
  }

  // routine for rendering every single individual day cell in the calendar
  dateCellRender(calendarDate: Moment): JSX.Element {
    const instancesForDay = this.state.events.filter(
      (e) =>
        moment(e.startDateTime).date() == calendarDate.date() &&
        moment(e.startDateTime).month() == calendarDate.month()
    );

    return (
      <ul className="events">
        {instancesForDay.map((instance) => (
          <CalendarInstance
            key={instance.googleId}
            instance={instance}
            parentFn={this.trackUntrackRecurringEvent.bind(this)}
          />
        ))}
      </ul>
    );
  }

  render(): React.ReactNode {
    const from = moment().date(1).hours(0).minutes(0).seconds(0);
    const to = moment(from).add(2, "months");
    // console.log(from);
    // console.log(to);

    // wrapping the whole calendar in a spinner for when we trigger a tracking
    // or untracking request against the API
    const spin = (foo: React.ReactNode): React.ReactNode => {
      if (this.state.spin) {
        return <Spin size="large"> {foo} </Spin>;
      } else {
        return foo;
      }
    };

    const calendar = (
      <>
        <PageHeader
          className="site-page-header"
          backIcon={false}
          title="Calendar"
          subTitle="Recurring events for the next two months of which you are the organizer"
        />
        <Calendar
          mode="month"
          dateCellRender={this.dateCellRender.bind(this)}
          validRange={[from, to]}
        />
      </>
    );
    return spin(calendar);
  }
}
