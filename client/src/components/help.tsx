import { Typography } from "antd";
const { Title, Paragraph, Text } = Typography;

export default function Help(): JSX.Element {
  return (
    <Typography>
      <Title>How to use Calentsar</Title>
      <Paragraph>
        1. Turn on tracking for recurring events of which you are the organizer.
        We recommend tracking recurring events with at least 3 attendees besides
        you.
      </Paragraph>
      <Paragraph>
        2. Calentsar will send a feedback survey to attendees of tracked
        recurring events at the end of each event.
      </Paragraph>
      <Paragraph>3. Your attendees fill out their feedback surveys</Paragraph>
      <Paragraph>
        4. You can now see longitudinal feedback for each instance of a
        recurring event and for their aggregate
      </Paragraph>
      <Title level={2}>Frequently Asked Questions</Title>
      <Title level={4}>At what stage of development is Calentsar?</Title>
      <Paragraph>
        The application is an MVP. We appreciate feedback and suggestions on
        what you would like to see more of in Calentsar in order to guide its
        development.
      </Paragraph>
      <Title level={4}>
        Can I use other calendars besides <Text code>primary</Text>?
      </Title>
      <Paragraph>Nope, not for now.</Paragraph>
      <Title level={4}>
        Can I track recurring events of which I am not the organizer?
      </Title>
      <Paragraph>Nope, not for now.</Paragraph>
      <Title level={4}>
        Can I see more than two months of recurring meetings on the calendar?
      </Title>
      <Paragraph>Nope, not for now.</Paragraph>
      <Title level={4}>
        Can I use Calentsar with a calendar system besides Google Calendar?
      </Title>
      <Paragraph>Nope, not for now.</Paragraph>
    </Typography>
  );
}
