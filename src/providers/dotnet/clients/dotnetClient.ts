import { UrlHelpers } from 'core/clients';
import { ProcessClientRequest } from 'infrastructure/clients';
import { DotNetSource } from '../definitions/dotnet';
import { DotNetConfig } from '../config';
import { ILogger } from 'core/generic/logging';

export class DotNetClient extends ProcessClientRequest {

  config: DotNetConfig;

  constructor(
    config: DotNetConfig,
    cacheDuration: number,
    logger: ILogger
  ) {
    super(cacheDuration)
    this.config = config;
  }

  async fetchSources(cwd: string): Promise<Array<DotNetSource>> {

    const promisedCli = super.request(
      'dotnet',
      ['nuget', 'list', 'source', '--format', 'short'],
      cwd
    );

    return promisedCli.then(result => {
      const { data } = result;

      // reject when data contains "error"
      if (data.indexOf("error") > -1) return Promise.reject(result);

      // check we have some data
      if (data.length === 0 || data.indexOf('E') === -1) {
        return [];
      }

      // extract sources
      const hasCrLf = data.indexOf(crLf) > 0;
      const splitChar = hasCrLf ? crLf : '\n';
      let lines = data.split(splitChar);

      // pop any blank entries
      if (lines[lines.length - 1] === '') lines.pop();

      return parseSourcesArray(lines);
    }).then(sources => {
      // combine the sources where feed take precedent
      const feedSources = convertFeedsToSources(this.config.getNuGetFeeds());
      return [
        ...feedSources,
        ...sources
      ]
    })
  }
}

const crLf = '\r\n';
function parseSourcesArray(lines: Array<string>): Array<DotNetSource> {
  return lines.map(function (line) {
    const enabled = line.substring(0, 1) === 'E';
    const machineWide = line.substring(1, 2) === 'M';
    const offset = machineWide ? 3 : 2;
    const url = line.substring(offset);
    const protocol = UrlHelpers.getProtocolFromUrl(url);
    return {
      enabled,
      machineWide,
      url,
      protocol
    };
  });
}

function convertFeedsToSources(feeds: Array<string>): Array<DotNetSource> {
  return feeds.map(function (url: string) {
    const protocol = UrlHelpers.getProtocolFromUrl(url);
    const machineWide = (protocol === UrlHelpers.RegistryProtocols.file);
    return {
      enabled: true,
      machineWide,
      url,
      protocol
    };
  });
}
